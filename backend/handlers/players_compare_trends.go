package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"

	"caught-looking/backend/models"

	"golang.org/x/sync/errgroup"
)

// yearByYearLeagueConcurrency caps parallel league-baseline fetches on cold year-by-year compares.
const yearByYearLeagueConcurrency = 5

type mlbPeopleYearByYearPayload struct {
	Stats []struct {
		Splits []struct {
			Season string          `json:"season"`
			Stat   json.RawMessage `json:"stat"`
			Player struct {
				ID       int64  `json:"id"`
				FullName string `json:"fullName"`
			} `json:"player"`
		} `json:"splits"`
	} `json:"stats"`
}

type mlbPeopleGameLogPayload struct {
	Stats []struct {
		Splits []struct {
			Date   string          `json:"date"`
			Stat   json.RawMessage `json:"stat"`
			Player struct {
				ID       int64  `json:"id"`
				FullName string `json:"fullName"`
			} `json:"player"`
			Game struct {
				GamePk int64 `json:"gamePk"`
			} `json:"game"`
		} `json:"splits"`
	} `json:"stats"`
}

// PlayersCompareYearByYear returns per-season rate stats for two players plus league baseline per season.
// Query metric (optional): hitting — ops (default), avg, obp, slg, woba; pitching — era (default), whip, k9, bb9, fip.
func (h *Handlers) PlayersCompareYearByYear(w http.ResponseWriter, r *http.Request) {
	id1, id2, err := parseTwoPlayerIDs(r.URL.Query().Get("ids"))
	if err != nil {
		if errors.Is(err, errTwoPlayerIDsFormat) {
			respondAPIError(w, http.StatusBadRequest, "query ids must be two comma-separated MLB person ids")
			return
		}
		respondAPIError(w, http.StatusBadRequest, "invalid ids")
		return
	}

	group, err := parseHittingPitchingGroup(r.URL.Query().Get("group"))
	if err != nil {
		respondAPIError(w, http.StatusBadRequest, "group must be hitting or pitching")
		return
	}

	metric := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("metric")))
	if metric == "" {
		if group == "pitching" {
			metric = "era"
		} else {
			metric = "ops"
		}
	}
	if !validYearByYearMetric(group, metric) {
		respondAPIError(w, http.StatusBadRequest, "invalid metric for group")
		return
	}

	cacheKey := "players-yearly:" + strconv.FormatInt(id1, 10) + ":" + strconv.FormatInt(id2, 10) + ":" + group + ":" + metric
	body, ttl, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLStandings, func(ctx context.Context) ([]byte, error) {
		g, gctx := errgroup.WithContext(ctx)
		var p1, p2 []models.SeasonPoint
		var n1, n2 string
		g.Go(func() error {
			var err error
			p1, n1, err = h.fetchPlayerYearByYear(gctx, id1, group, metric)
			return err
		})
		g.Go(func() error {
			var err error
			p2, n2, err = h.fetchPlayerYearByYear(gctx, id2, group, metric)
			return err
		})
		if err := g.Wait(); err != nil {
			return nil, err
		}

		seasonSeen := map[int]struct{}{}
		for _, p := range p1 {
			seasonSeen[p.Season] = struct{}{}
		}
		for _, p := range p2 {
			seasonSeen[p.Season] = struct{}{}
		}

		leagueBySeason := make(map[string]float64, len(seasonSeen))
		lg, lgctx := errgroup.WithContext(ctx)
		sem := make(chan struct{}, yearByYearLeagueConcurrency)
		var mu sync.Mutex
		for sy := range seasonSeen {
			sy := sy
			lg.Go(func() error {
				select {
				case sem <- struct{}{}:
					defer func() { <-sem }()
				case <-lgctx.Done():
					return lgctx.Err()
				}
				v, err := h.fetchLeagueBaselineMetric(lgctx, sy, group, metric)
				if err != nil {
					return err
				}
				mu.Lock()
				leagueBySeason[strconv.Itoa(sy)] = v
				mu.Unlock()
				return nil
			})
		}
		if err := lg.Wait(); err != nil {
			return nil, err
		}

		out := models.PlayersYearByYearResponse{
			Group:          group,
			Metric:         metric,
			LeagueBySeason: leagueBySeason,
			Players: []models.YearSeriesPlayer{
				{ID: id1, FullName: n1, Points: p1},
				{ID: id2, FullName: n2, Points: p2},
			},
		}
		return marshalCachedJSON(out)
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body, ttl)
}

func validYearByYearMetric(group, metric string) bool {
	switch group {
	case "hitting":
		switch metric {
		case "ops", "avg", "obp", "slg", "woba":
			return true
		}
	case "pitching":
		switch metric {
		case "era", "whip", "k9", "bb9", "fip":
			return true
		}
	}
	return false
}

func yearByYearPlayerStat(statMap map[string]interface{}, group, metric string) float64 {
	switch group {
	case "hitting":
		switch metric {
		case "ops":
			return statFloat(statMap["ops"])
		case "avg":
			return statFloat(statMap["avg"])
		case "obp":
			return statFloat(statMap["obp"])
		case "slg":
			return statFloat(statMap["slg"])
		case "woba":
			if v := statFloat(statMap["woba"]); v > 0 {
				return v
			}
			return statFloat(statMap["weightedOnBaseAverage"])
		}
	case "pitching":
		switch metric {
		case "era":
			return statFloat(statMap["era"])
		case "whip":
			return statFloat(statMap["whip"])
		case "k9":
			return statFloat(statMap["strikeoutsPer9Inn"])
		case "bb9":
			return statFloat(statMap["walksPer9Inn"])
		case "fip":
			return statFloat(statMap["fip"])
		}
	}
	return 0
}

func (h *Handlers) fetchPlayerYearByYear(ctx context.Context, id int64, group, metric string) ([]models.SeasonPoint, string, error) {
	q := url.Values{}
	q.Set("stats", "yearByYear")
	q.Set("group", group)
	path := "/people/" + strconv.FormatInt(id, 10) + "/stats?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return nil, "", err
	}

	var payload mlbPeopleYearByYearPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, "", wrapUpstreamJSONParse(err)
	}

	name := ""
	if len(payload.Stats) > 0 && len(payload.Stats[0].Splits) > 0 {
		name = payload.Stats[0].Splits[0].Player.FullName
	}

	var out []models.SeasonPoint
	if len(payload.Stats) == 0 {
		return out, name, nil
	}

	for _, sp := range payload.Stats[0].Splits {
		var statMap map[string]interface{}
		if err := json.Unmarshal(sp.Stat, &statMap); err != nil {
			continue
		}
		year, err := strconv.Atoi(strings.TrimSpace(sp.Season))
		if err != nil || year < 1900 {
			continue
		}
		v := yearByYearPlayerStat(statMap, group, metric)
		if v <= 0 {
			continue
		}
		out = append(out, models.SeasonPoint{Season: year, Value: v})
	}

	sort.Slice(out, func(i, j int) bool { return out[i].Season < out[j].Season })
	return out, name, nil
}

// PlayersCompareGameLog returns the last N games of OPS or ERA for two players in a season, plus league baseline.
func (h *Handlers) PlayersCompareGameLog(w http.ResponseWriter, r *http.Request) {
	id1, id2, err := parseTwoPlayerIDs(r.URL.Query().Get("ids"))
	if err != nil {
		if errors.Is(err, errTwoPlayerIDsFormat) {
			respondAPIError(w, http.StatusBadRequest, "query ids must be two comma-separated MLB person ids")
			return
		}
		respondAPIError(w, http.StatusBadRequest, "invalid ids")
		return
	}

	group, err := parseHittingPitchingGroup(r.URL.Query().Get("group"))
	if err != nil {
		respondAPIError(w, http.StatusBadRequest, "group must be hitting or pitching")
		return
	}

	season, err := parseSeasonOrDefault(r.URL.Query().Get("season"), h.cfg.DefaultSeason)
	if err != nil {
		respondAPIError(w, http.StatusBadRequest, "invalid season")
		return
	}

	limit := 28
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 5 || n > 60 {
			respondAPIError(w, http.StatusBadRequest, "limit must be between 5 and 60")
			return
		}
		limit = n
	}

	metric := "ops"
	if group == "pitching" {
		metric = "era"
	}

	cacheKey := "players-gamelog:" + strconv.FormatInt(id1, 10) + ":" + strconv.FormatInt(id2, 10) + ":" + group + ":" + strconv.Itoa(season) + ":" + strconv.Itoa(limit)
	body, ttl, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLScores, func(ctx context.Context) ([]byte, error) {
		g, gctx := errgroup.WithContext(ctx)
		var g1, g2 []models.GamePoint
		var n1, n2 string
		g.Go(func() error {
			var err error
			g1, n1, err = h.fetchPlayerGameLog(gctx, id1, group, season, limit)
			return err
		})
		g.Go(func() error {
			var err error
			g2, n2, err = h.fetchPlayerGameLog(gctx, id2, group, season, limit)
			return err
		})
		if err := g.Wait(); err != nil {
			return nil, err
		}

		lb, err := h.fetchLeagueBaseline(ctx, season, group)
		if err != nil {
			return nil, err
		}

		out := models.PlayersGameLogResponse{
			Season:         season,
			Group:          group,
			Metric:         metric,
			Limit:          limit,
			LeagueBaseline: lb,
			Players: []models.GameLogPlayer{
				{ID: id1, FullName: n1, Games: g1},
				{ID: id2, FullName: n2, Games: g2},
			},
		}
		return marshalCachedJSON(out)
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body, ttl)
}

func (h *Handlers) fetchPlayerGameLog(ctx context.Context, id int64, group string, season, limit int) ([]models.GamePoint, string, error) {
	q := url.Values{}
	q.Set("stats", "gameLog")
	q.Set("group", group)
	q.Set("season", strconv.Itoa(season))
	path := "/people/" + strconv.FormatInt(id, 10) + "/stats?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return nil, "", err
	}

	var payload mlbPeopleGameLogPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, "", wrapUpstreamJSONParse(err)
	}

	name := ""
	if len(payload.Stats) > 0 && len(payload.Stats[0].Splits) > 0 {
		name = payload.Stats[0].Splits[0].Player.FullName
	}

	var games []models.GamePoint
	if len(payload.Stats) == 0 {
		return games, name, nil
	}

	for _, sp := range payload.Stats[0].Splits {
		var statMap map[string]interface{}
		if err := json.Unmarshal(sp.Stat, &statMap); err != nil {
			continue
		}
		var v float64
		if group == "hitting" {
			v = statFloat(statMap["ops"])
		} else {
			v = statFloat(statMap["era"])
		}
		if v <= 0 {
			continue
		}
		games = append(games, models.GamePoint{
			Date:   strings.TrimSpace(sp.Date),
			GamePk: sp.Game.GamePk,
			Value:  v,
		})
	}

	sort.Slice(games, func(i, j int) bool { return games[i].Date < games[j].Date })
	if len(games) > limit {
		games = games[len(games)-limit:]
	}
	return games, name, nil
}
