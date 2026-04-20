package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"
)

type mlbTeamStatsPayload struct {
	Stats []struct {
		Splits []struct {
			Stat json.RawMessage `json:"stat"`
		} `json:"splits"`
	} `json:"stats"`
}

// TeamSeasonStats returns season aggregates (team hitting & pitching) for one club.
func (h *Handlers) TeamSeasonStats(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "teamID")
	teamID, err := strconv.Atoi(strings.TrimSpace(idStr))
	if err != nil || teamID <= 0 {
		http.Error(w, "invalid team id", http.StatusBadRequest)
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

	cacheKey := "team-season-stats:" + strconv.Itoa(teamID) + ":" + strconv.Itoa(season)
	if body, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
		return
	}

	ctx := r.Context()
	g, gctx := errgroup.WithContext(ctx)
	var hit models.TeamHittingLine
	var pit models.TeamPitchingLine

	g.Go(func() error {
		var err error
		hit, err = h.fetchTeamHittingSeason(gctx, teamID, season)
		return err
	})
	g.Go(func() error {
		var err error
		pit, err = h.fetchTeamPitchingSeason(gctx, teamID, season)
		return err
	})
	if err := g.Wait(); err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	out := models.TeamSeasonStatsResponse{
		Season:   season,
		TeamID:   teamID,
		Hitting:  hit,
		Pitching: pit,
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

func (h *Handlers) fetchTeamHittingSeason(ctx context.Context, teamID int, season int) (models.TeamHittingLine, error) {
	q := url.Values{}
	q.Set("stats", "season")
	q.Set("group", "hitting")
	q.Set("season", strconv.Itoa(season))
	path := "/teams/" + strconv.Itoa(teamID) + "/stats?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return models.TeamHittingLine{}, err
	}

	var payload mlbTeamStatsPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return models.TeamHittingLine{}, err
	}

	var line models.TeamHittingLine
	if len(payload.Stats) == 0 || len(payload.Stats[0].Splits) == 0 {
		return line, nil
	}

	var statMap map[string]interface{}
	if err := json.Unmarshal(payload.Stats[0].Splits[0].Stat, &statMap); err != nil {
		return line, nil
	}

	line.GamesPlayed = intFromStat(statMap["gamesPlayed"])
	line.Runs = intFromStat(statMap["runs"])
	if line.GamesPlayed > 0 {
		line.RunsPerGame = float64(line.Runs) / float64(line.GamesPlayed)
	}
	line.Ops = statFloat(statMap["ops"])
	line.Obp = statFloat(statMap["obp"])
	line.Slg = statFloat(statMap["slg"])
	line.Avg = statFloat(statMap["avg"])
	return line, nil
}

func (h *Handlers) fetchTeamPitchingSeason(ctx context.Context, teamID int, season int) (models.TeamPitchingLine, error) {
	q := url.Values{}
	q.Set("stats", "season")
	q.Set("group", "pitching")
	q.Set("season", strconv.Itoa(season))
	path := "/teams/" + strconv.Itoa(teamID) + "/stats?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return models.TeamPitchingLine{}, err
	}

	var payload mlbTeamStatsPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return models.TeamPitchingLine{}, err
	}

	var line models.TeamPitchingLine
	if len(payload.Stats) == 0 || len(payload.Stats[0].Splits) == 0 {
		return line, nil
	}

	var statMap map[string]interface{}
	if err := json.Unmarshal(payload.Stats[0].Splits[0].Stat, &statMap); err != nil {
		return line, nil
	}

	line.GamesPlayed = intFromStat(statMap["gamesPlayed"])
	line.RunsAllowed = intFromStat(statMap["runs"])
	if line.GamesPlayed > 0 {
		line.RunsAllowedPerGame = float64(line.RunsAllowed) / float64(line.GamesPlayed)
	}
	line.Era = statFloat(statMap["era"])
	line.Whip = statFloat(statMap["whip"])
	line.K9 = statFloat(statMap["strikeoutsPer9Inn"])
	line.BB9 = statFloat(statMap["walksPer9Inn"])
	return line, nil
}

func intFromStat(v interface{}) int {
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case string:
		t = strings.TrimSpace(t)
		if t == "" {
			return 0
		}
		n, err := strconv.Atoi(t)
		if err != nil {
			return 0
		}
		return n
	default:
		return 0
	}
}

func statFloat(v interface{}) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case int:
		return float64(t)
	case string:
		t = strings.TrimSpace(t)
		if t == "" || t == ".---" || t == "-.--" {
			return 0
		}
		f, err := strconv.ParseFloat(t, 64)
		if err != nil {
			return 0
		}
		return f
	default:
		return 0
	}
}
