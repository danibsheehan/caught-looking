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
			Stat   json.RawMessage `json:"stat"`
			Team   struct{ ID int `json:"id"` } `json:"team"`
			League struct{ ID int `json:"id"` } `json:"league"`
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
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
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
		http.Error(w, "encode error", http.StatusInternalServerError)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLStandings)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

func (h *Handlers) fetchLeagueBaseline(ctx context.Context, season int, group string) (float64, error) {
	q := url.Values{}
	q.Set("stats", "season")
	q.Set("group", group)
	q.Set("season", strconv.Itoa(season))
	q.Set("sportIds", "1")
	q.Set("gameType", "R")
	path := "/stats?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return 0, err
	}

	var payload mlbTeamSeasonSplitsPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return 0, err
	}
	if len(payload.Stats) == 0 || len(payload.Stats[0].Splits) == 0 {
		return 0, nil
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
			return 0, nil
		}
		obp := float64(hTot+bb+hbp) / float64(den)
		slg := float64(tb) / float64(ab)
		return obp + slg, nil
	}

	var er int
	var ip float64
	for _, sm := range best {
		er += intFromStat(sm["earnedRuns"])
		ip += parseBaseballInnings(fmtSprint(sm["inningsPitched"]))
	}
	if ip < 1e-6 {
		return 0, nil
	}
	return 9.0 * float64(er) / ip, nil
}
