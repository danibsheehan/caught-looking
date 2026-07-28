package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"caught-looking/backend/models"

	"golang.org/x/sync/errgroup"
)

type mlbPeopleStatsPayload struct {
	Stats []struct {
		Splits []struct {
			Season string `json:"season"`
			Player struct {
				ID       int64  `json:"id"`
				FullName string `json:"fullName"`
			} `json:"player"`
			Stat json.RawMessage `json:"stat"`
		} `json:"splits"`
	} `json:"stats"`
}

// PlayersCompare returns stat snapshots for two players (hitting or pitching), season or career.
func (h *Handlers) PlayersCompare(w http.ResponseWriter, r *http.Request) {
	ids := strings.TrimSpace(r.URL.Query().Get("ids"))
	parts := strings.Split(ids, ",")
	if len(parts) != 2 {
		respondAPIError(w, http.StatusBadRequest, "query ids must be two comma-separated MLB person ids")
		return
	}
	id1, err1 := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 64)
	id2, err2 := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
	if err1 != nil || err2 != nil || id1 <= 0 || id2 <= 0 {
		respondAPIError(w, http.StatusBadRequest, "invalid ids")
		return
	}

	group := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("group")))
	if group == "" {
		group = "hitting"
	}
	if group != "hitting" && group != "pitching" {
		respondAPIError(w, http.StatusBadRequest, "group must be hitting or pitching")
		return
	}

	scope := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("scope")))
	if scope == "" {
		scope = "season"
	}
	if scope != "season" && scope != "career" {
		respondAPIError(w, http.StatusBadRequest, "scope must be season or career")
		return
	}

	season := h.cfg.DefaultSeason
	if scope == "season" {
		if v := strings.TrimSpace(r.URL.Query().Get("season")); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil || n < 1900 || n > 2100 {
				respondAPIError(w, http.StatusBadRequest, "invalid season")
				return
			}
			season = n
		}
	}

	cacheKey := "players-compare:" + scope + ":" + strconv.FormatInt(id1, 10) + ":" + strconv.FormatInt(id2, 10) + ":" + group
	if scope == "season" {
		cacheKey += ":" + strconv.Itoa(season)
	}

	body, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLStandings, func(ctx context.Context) ([]byte, error) {
		g, gctx := errgroup.WithContext(ctx)
		var p1, p2 models.PlayerStatSnapshot
		g.Go(func() error {
			var err error
			p1, err = h.fetchPlayerStats(gctx, id1, group, scope, season)
			return err
		})
		g.Go(func() error {
			var err error
			p2, err = h.fetchPlayerStats(gctx, id2, group, scope, season)
			return err
		})
		if err := g.Wait(); err != nil {
			return nil, err
		}

		outSeason := 0
		if scope == "season" {
			outSeason = season
		}
		out := models.PlayersRadarResponse{
			Scope:   scope,
			Season:  outSeason,
			Group:   group,
			Players: []models.PlayerStatSnapshot{p1, p2},
		}
		return marshalCachedJSON(out)
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body)
}

func (h *Handlers) fetchPlayerStats(ctx context.Context, id int64, group, scope string, season int) (models.PlayerStatSnapshot, error) {
	q := url.Values{}
	if scope == "career" {
		q.Set("stats", "career")
	} else {
		q.Set("stats", "season")
		q.Set("season", strconv.Itoa(season))
	}
	q.Set("group", group)
	path := "/people/" + strconv.FormatInt(id, 10) + "/stats?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return models.PlayerStatSnapshot{}, err
	}

	var payload mlbPeopleStatsPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return models.PlayerStatSnapshot{}, wrapUpstreamJSONParse(err)
	}

	var snap models.PlayerStatSnapshot
	snap.ID = id
	snap.Group = group
	snap.Stats = map[string]float64{}

	if len(payload.Stats) == 0 || len(payload.Stats[0].Splits) == 0 {
		return snap, nil
	}

	split := payload.Stats[0].Splits[0]
	snap.FullName = split.Player.FullName
	if split.Player.ID != 0 {
		snap.ID = split.Player.ID
	}

	var statMap map[string]interface{}
	if err := json.Unmarshal(split.Stat, &statMap); err != nil {
		return snap, nil
	}

	applyPlayerGroupStats(snap.Stats, group, statMap)
	return snap, nil
}

func applyPlayerGroupStats(dst map[string]float64, group string, statMap map[string]interface{}) {
	if group == "hitting" {
		putFloat(dst, "avg", statMap["avg"])
		putFloat(dst, "obp", statMap["obp"])
		putFloat(dst, "slg", statMap["slg"])
		putFloat(dst, "ops", statMap["ops"])
		putFloat(dst, "hr", statMap["homeRuns"])
		putFloat(dst, "rbi", statMap["rbi"])
		putFloat(dst, "runs", statMap["runs"])
		putFloat(dst, "hits", statMap["hits"])
		putFloat(dst, "doubles", statMap["doubles"])
		putFloat(dst, "triples", statMap["triples"])
		putFloat(dst, "walks", statMap["baseOnBalls"])
		putStatFloat(dst, "strikeouts", statMap, "strikeOuts", "strikeouts")
		putFloat(dst, "stolenBases", statMap["stolenBases"])
		putFloat(dst, "pa", statMap["plateAppearances"])
		putFloat(dst, "g", statMap["gamesPlayed"])
		putStatFloat(dst, "woba", statMap, "woba", "weightedOnBaseAverage")
		return
	}
	putFloat(dst, "era", statMap["era"])
	putFloat(dst, "whip", statMap["whip"])
	putFloat(dst, "k9", statMap["strikeoutsPer9Inn"])
	putFloat(dst, "bb9", statMap["walksPer9Inn"])
	putInnings(dst, "ip", statMap["inningsPitched"])
	putFloat(dst, "g", statMap["gamesPlayed"])
	putFloat(dst, "wins", statMap["wins"])
	putFloat(dst, "losses", statMap["losses"])
	putFloat(dst, "saves", statMap["saves"])
	putFloat(dst, "holds", statMap["holds"])
	putStatFloat(dst, "strikeouts", statMap, "strikeOuts", "strikeouts")
	putFloat(dst, "walks", statMap["baseOnBalls"])
	putFloat(dst, "hrAllowed", statMap["homeRuns"])
	putFloat(dst, "fip", statMap["fip"])
}

func putFloat(dst map[string]float64, key string, v interface{}) {
	switch t := v.(type) {
	case float64:
		dst[key] = t
	case int:
		dst[key] = float64(t)
	case string:
		t = strings.TrimSpace(t)
		if t == "" || t == ".---" || t == "-.--" {
			return
		}
		f, err := strconv.ParseFloat(t, 64)
		if err == nil {
			dst[key] = f
		}
	}
}

// putStatFloat sets dst[key] from the first present JSON field (e.g. strikeOuts vs strikeouts).
func putStatFloat(dst map[string]float64, key string, statMap map[string]interface{}, jsonKeys ...string) {
	for _, jk := range jsonKeys {
		if _, ok := statMap[jk]; ok {
			putFloat(dst, key, statMap[jk])
			return
		}
	}
}

// putInnings parses MLB innings strings ("95.0", "182.1", "182.2") into fractional innings for sorting/math.
func putInnings(dst map[string]float64, key string, v interface{}) {
	s := strings.TrimSpace(fmtSprint(v))
	if s == "" {
		return
	}
	n := parseBaseballInnings(s)
	if n > 0 {
		dst[key] = n
	}
}

func fmtSprint(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case int:
		return strconv.Itoa(t)
	default:
		return ""
	}
}

func parseBaseballInnings(s string) float64 {
	parts := strings.SplitN(s, ".", 2)
	whole, err := strconv.ParseFloat(parts[0], 64)
	if err != nil {
		f, err2 := strconv.ParseFloat(strings.TrimSpace(s), 64)
		if err2 != nil {
			return 0
		}
		return f
	}
	if len(parts) < 2 || parts[1] == "" {
		return whole
	}
	frac := parts[1]
	if len(frac) == 0 {
		return whole
	}
	switch frac[0] {
	case '1':
		return whole + 1.0/3.0
	case '2':
		return whole + 2.0/3.0
	default:
		f, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return whole
		}
		return f
	}
}
