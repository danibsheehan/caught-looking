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

// PlayersCompare returns season stat snapshots for two players (hitting or pitching).
func (h *Handlers) PlayersCompare(w http.ResponseWriter, r *http.Request) {
	ids := strings.TrimSpace(r.URL.Query().Get("ids"))
	parts := strings.Split(ids, ",")
	if len(parts) != 2 {
		http.Error(w, "query ids must be two comma-separated MLB person ids", http.StatusBadRequest)
		return
	}
	id1, err1 := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 64)
	id2, err2 := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
	if err1 != nil || err2 != nil || id1 <= 0 || id2 <= 0 {
		http.Error(w, "invalid ids", http.StatusBadRequest)
		return
	}

	group := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("group")))
	if group == "" {
		group = "hitting"
	}
	if group != "hitting" && group != "pitching" {
		http.Error(w, "group must be hitting or pitching", http.StatusBadRequest)
		return
	}

	season := h.cfg.DefaultSeason
	if v := strings.TrimSpace(r.URL.Query().Get("season")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1900 || n > 2100 {
			http.Error(w, "invalid season", http.StatusBadRequest)
			return
		}
		season = n
	}

	cacheKey := "players-compare:" + strconv.FormatInt(id1, 10) + ":" + strconv.FormatInt(id2, 10) + ":" + group + ":" + strconv.Itoa(season)
	if body, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
		return
	}

	ctx := r.Context()
	g, gctx := errgroup.WithContext(ctx)
	var p1, p2 models.PlayerStatSnapshot
	g.Go(func() error {
		var err error
		p1, err = h.fetchPlayerSeasonStats(gctx, id1, group, season)
		return err
	})
	g.Go(func() error {
		var err error
		p2, err = h.fetchPlayerSeasonStats(gctx, id2, group, season)
		return err
	})
	if err := g.Wait(); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	out := models.PlayersRadarResponse{
		Season:  season,
		Group:   group,
		Players: []models.PlayerStatSnapshot{p1, p2},
	}

	body, err := json.Marshal(out)
	if err != nil {
		http.Error(w, "encode error", http.StatusInternalServerError)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLScores)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

func (h *Handlers) fetchPlayerSeasonStats(ctx context.Context, id int64, group string, season int) (models.PlayerStatSnapshot, error) {
	q := url.Values{}
	q.Set("stats", "season")
	q.Set("group", group)
	q.Set("season", strconv.Itoa(season))
	path := "/people/" + strconv.FormatInt(id, 10) + "/stats?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return models.PlayerStatSnapshot{}, err
	}

	var payload mlbPeopleStatsPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return models.PlayerStatSnapshot{}, err
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

	if group == "hitting" {
		putFloat(snap.Stats, "avg", statMap["avg"])
		putFloat(snap.Stats, "obp", statMap["obp"])
		putFloat(snap.Stats, "slg", statMap["slg"])
		putFloat(snap.Stats, "hr", statMap["homeRuns"])
		putFloat(snap.Stats, "rbi", statMap["rbi"])
	} else {
		putFloat(snap.Stats, "era", statMap["era"])
		putFloat(snap.Stats, "whip", statMap["whip"])
		putFloat(snap.Stats, "k9", statMap["strikeoutsPer9Inn"])
		putFloat(snap.Stats, "bb9", statMap["walksPer9Inn"])
	}

	return snap, nil
}

func putFloat(dst map[string]float64, key string, v interface{}) {
	switch t := v.(type) {
	case float64:
		dst[key] = t
	case int:
		dst[key] = float64(t)
	case string:
		t = strings.TrimSpace(t)
		if t == "" || t == ".---" {
			return
		}
		f, err := strconv.ParseFloat(t, 64)
		if err == nil {
			dst[key] = f
		}
	}
}
