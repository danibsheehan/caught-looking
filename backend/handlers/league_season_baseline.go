package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"caught-looking/backend/models"
)

type mlbTeamSeasonSplitsPayload struct {
	Stats []struct {
		Splits []struct {
			Stat json.RawMessage `json:"stat"`
			Team struct {
				ID int `json:"id"`
			} `json:"team"`
			League struct {
				ID int `json:"id"`
			} `json:"league"`
		} `json:"splits"`
	} `json:"stats"`
}

// LeagueSeasonBaseline returns league OPS (hitting) or ERA (pitching) for MLB (AL+NL) from team season totals.
func (h *Handlers) LeagueSeasonBaseline(w http.ResponseWriter, r *http.Request) {
	season := h.cfg.DefaultSeason
	if v := strings.TrimSpace(r.URL.Query().Get("season")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1900 || n > 2100 {
			http.Error(w, "invalid season", http.StatusBadRequest)
			return
		}
		season = n
	}

	group := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("group")))
	if group == "" {
		group = "hitting"
	}
	if group != "hitting" && group != "pitching" {
		http.Error(w, "group must be hitting or pitching", http.StatusBadRequest)
		return
	}

	cacheKey := "league-baseline:" + group + ":" + strconv.Itoa(season)
	if body, ok := h.cache.Get(cacheKey); ok {
		writeJSONBytes(w, body)
		return
	}

	val, err := h.fetchLeagueBaseline(r.Context(), season, group)
	if err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	out := models.LeagueSeasonBaselineResponse{Season: season, Group: group}
	if group == "hitting" {
		out.Ops = val
	} else {
		out.Era = val
	}

	body, err := json.Marshal(out)
	if err != nil {
		respondJSONEncodeError(w)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLStandings)
	writeJSONBytes(w, body)
}

func (h *Handlers) fetchLeagueBaseline(ctx context.Context, season int, group string) (float64, error) {
	best, err := h.loadLeagueTeamStatMaps(ctx, season, group)
	if err != nil {
		return 0, err
	}
	if group == "hitting" {
		return leagueRateFromTeamMaps(best, group, "ops"), nil
	}
	return leagueRateFromTeamMaps(best, group, "era"), nil
}

// fetchLeagueBaselineMetric returns the same AL+NL team-aggregate rate as /league/season-baseline
// for OPS/ERA, and extended metrics used by GET /players/compare/year-by-year.
func (h *Handlers) fetchLeagueBaselineMetric(ctx context.Context, season int, group, metric string) (float64, error) {
	best, err := h.loadLeagueTeamStatMaps(ctx, season, group)
	if err != nil {
		return 0, err
	}
	return leagueRateFromTeamMaps(best, group, metric), nil
}

func (h *Handlers) loadLeagueTeamStatMaps(ctx context.Context, season int, group string) (map[int]map[string]interface{}, error) {
	q := url.Values{}
	q.Set("stats", "season")
	q.Set("group", group)
	q.Set("season", strconv.Itoa(season))
	q.Set("sportIds", "1")
	q.Set("gameType", "R")
	path := "/stats?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return nil, err
	}

	var payload mlbTeamSeasonSplitsPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	if len(payload.Stats) == 0 || len(payload.Stats[0].Splits) == 0 {
		return map[int]map[string]interface{}{}, nil
	}

	// One row per MLB team (dedupe franchise; keep max games).
	best := map[int]map[string]interface{}{}
	for _, sp := range payload.Stats[0].Splits {
		lg := sp.League.ID
		if lg != 103 && lg != 104 {
			continue
		}
		tid := sp.Team.ID
		if tid <= 0 {
			continue
		}
		var statMap map[string]interface{}
		if err := json.Unmarshal(sp.Stat, &statMap); err != nil {
			continue
		}
		gp := intFromStat(statMap["gamesPlayed"])
		if prev, ok := best[tid]; ok {
			if intFromStat(prev["gamesPlayed"]) >= gp {
				continue
			}
		}
		best[tid] = statMap
	}
	return best, nil
}

func leagueRateFromTeamMaps(best map[int]map[string]interface{}, group, metric string) float64 {
	if group == "hitting" {
		var hTot, ab, tb, bb, hbp, sf int
		for _, sm := range best {
			hTot += intFromStat(sm["hits"])
			ab += intFromStat(sm["atBats"])
			tb += intFromStat(sm["totalBases"])
			bb += intFromStat(sm["baseOnBalls"])
			hbp += intFromStat(sm["hitByPitch"])
			sf += intFromStat(sm["sacFlies"])
		}
		den := ab + bb + hbp + sf
		if ab == 0 || den == 0 {
			return 0
		}
		obp := float64(hTot+bb+hbp) / float64(den)
		slg := float64(tb) / float64(ab)
		switch metric {
		case "ops":
			return obp + slg
		case "avg":
			return float64(hTot) / float64(ab)
		case "obp":
			return obp
		case "slg":
			return slg
		case "woba":
			var wobaNum, paSum float64
			for _, sm := range best {
				w := statFloat(sm["weightedOnBaseAverage"])
				if w <= 0 {
					w = statFloat(sm["woba"])
				}
				pa := float64(intFromStat(sm["plateAppearances"]))
				if w > 0 && pa > 0 {
					wobaNum += w * pa
					paSum += pa
				}
			}
			if paSum > 1e-6 {
				return wobaNum / paSum
			}
			return 0
		default:
			return 0
		}
	}

	var er, hAllowed, bb, so, hr int
	var ip float64
	for _, sm := range best {
		er += intFromStat(sm["earnedRuns"])
		hAllowed += intFromStat(sm["hits"])
		bb += intFromStat(sm["baseOnBalls"])
		so += intFromStat(sm["strikeOuts"])
		hr += intFromStat(sm["homeRuns"])
		ip += parseBaseballInnings(fmtSprint(sm["inningsPitched"]))
	}
	if ip < 1e-6 {
		return 0
	}
	switch metric {
	case "era":
		return 9.0 * float64(er) / ip
	case "whip":
		return float64(hAllowed+bb) / ip
	case "k9":
		return 9.0 * float64(so) / ip
	case "bb9":
		return 9.0 * float64(bb) / ip
	case "fip":
		var num, wip float64
		for _, sm := range best {
			f := statFloat(sm["fip"])
			inn := parseBaseballInnings(fmtSprint(sm["inningsPitched"]))
			if f > 0 && inn > 0 {
				num += f * inn
				wip += inn
			}
		}
		if wip > 1e-6 {
			return num / wip
		}
		// Fallback: classic FIP shape from league counting totals (no run-environment constant).
		hbp := 0
		for _, sm := range best {
			hbp += intFromStat(sm["hitByPitch"])
		}
		return (13.0*float64(hr) + 3.0*float64(bb+hbp) - 2.0*float64(so)) / ip
	default:
		return 0
	}
}
