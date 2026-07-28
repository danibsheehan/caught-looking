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
		respondAPIError(w, http.StatusBadRequest, "invalid team id")
		return
	}

	season, err := parseSeasonOrDefault(r.URL.Query().Get("season"), h.cfg.DefaultSeason)
	if err != nil {
		respondAPIError(w, http.StatusBadRequest, "invalid season")
		return
	}

	cacheKey := "team-season-stats-v4:" + strconv.Itoa(teamID) + ":" + strconv.Itoa(season)
	body, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLScores, func(ctx context.Context) ([]byte, error) {
		g, gctx := errgroup.WithContext(ctx)
		var hit models.TeamHittingLine
		var pit models.TeamPitchingLine
		var venue models.TeamVenueSplits

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
		g.Go(func() error {
			venue = h.fetchTeamVenueSplitsBestEffort(gctx, teamID, season)
			return nil
		})
		if err := g.Wait(); err != nil {
			return nil, err
		}

		out := models.TeamSeasonStatsResponse{
			Season:      season,
			TeamID:      teamID,
			Hitting:     hit,
			Pitching:    pit,
			VenueSplits: venue,
		}
		return marshalCachedJSON(out)
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body)
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
		return models.TeamHittingLine{}, wrapUpstreamJSONParse(err)
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

	line.Doubles = intFromStat(statMap["doubles"])
	line.StolenBases = intFromStat(statMap["stolenBases"])
	hr := intFromStat(statMap["homeRuns"])
	line.HomeRuns = hr
	if line.GamesPlayed > 0 {
		line.HomeRunsPerGame = float64(hr) / float64(line.GamesPlayed)
	}
	pa := intFromStat(statMap["plateAppearances"])
	bb := intFromStat(statMap["baseOnBalls"])
	so := intFromStat(statMap["strikeOuts"])
	if pa > 0 {
		line.BbPct = 100 * float64(bb) / float64(pa)
		line.KPct = 100 * float64(so) / float64(pa)
	}
	tb := intFromStat(statMap["totalBases"])
	hits := intFromStat(statMap["hits"])
	ab := intFromStat(statMap["atBats"])
	if ab > 0 {
		line.IsolatedPower = float64(tb-hits) / float64(ab)
	}
	line.Babip = statFloat(statMap["babip"])
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
		return models.TeamPitchingLine{}, wrapUpstreamJSONParse(err)
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
	line.Hr9 = statFloat(statMap["homeRunsPer9"])
	line.H9 = statFloat(statMap["hitsPer9"])
	line.Kbb = statFloat(statMap["strikeoutWalkRatio"])
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
