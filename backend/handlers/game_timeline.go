package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"
)

type mlbLinescorePayload struct {
	Innings []struct {
		Num  int `json:"num"`
		Home struct {
			Runs int `json:"runs"`
		} `json:"home"`
		Away struct {
			Runs int `json:"runs"`
		} `json:"away"`
	} `json:"innings"`
	Teams struct {
		Home struct {
			Runs int `json:"runs"`
		} `json:"home"`
		Away struct {
			Runs int `json:"runs"`
		} `json:"away"`
	} `json:"teams"`
	Status struct {
		AbstractGameState string `json:"abstractGameState"`
		DetailedState     string `json:"detailedState"`
	} `json:"status"`
}

type mlbBoxscoreTeams struct {
	Teams struct {
		Home struct {
			Team struct {
				ID   int    `json:"id"`
				Name string `json:"name"`
			} `json:"team"`
		} `json:"home"`
		Away struct {
			Team struct {
				ID   int    `json:"id"`
				Name string `json:"name"`
			} `json:"team"`
		} `json:"away"`
	} `json:"teams"`
}

// GameTimeline returns inning-by-inning runs from the linescore feed.
func (h *Handlers) GameTimeline(w http.ResponseWriter, r *http.Request) {
	pkStr := strings.TrimSpace(chi.URLParam(r, "gamePk"))
	gamePk, err := strconv.ParseInt(pkStr, 10, 64)
	if err != nil || gamePk <= 0 {
		respondAPIError(w, http.StatusBadRequest, "invalid gamePk")
		return
	}

	cacheKey := "game-timeline:" + pkStr
	body, ttl, err := h.cache.GetOrLoadWithTTL(r.Context(), cacheKey, func(ctx context.Context) ([]byte, time.Duration, error) {
		g, gctx := errgroup.WithContext(ctx)
		var raw []byte
		var rawBox []byte
		g.Go(func() error {
			var err error
			raw, err = h.mlb.Get(gctx, "/game/"+pkStr+"/linescore")
			return err
		})
		g.Go(func() error {
			b, err := h.fetchGameBoxscoreRaw(gctx, pkStr)
			if err != nil {
				return err
			}
			rawBox = b
			return nil
		})
		if err := g.Wait(); err != nil {
			return nil, 0, err
		}

		var payload mlbLinescorePayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			return nil, 0, wrapUpstreamJSONParse(err)
		}

		var box mlbBoxscoreTeams
		if err := json.Unmarshal(rawBox, &box); err != nil {
			return nil, 0, wrapUpstreamJSONParse(err)
		}

		innings := make([]models.InningScore, 0, len(payload.Innings))
		for _, inn := range payload.Innings {
			innings = append(innings, models.InningScore{
				Inning:   inn.Num,
				HomeRuns: inn.Home.Runs,
				AwayRuns: inn.Away.Runs,
			})
		}

		status := gameDisplayStatus(payload.Status.DetailedState, payload.Status.AbstractGameState)
		out := models.GameTimelineResponse{
			GamePk:    gamePk,
			Status:    status,
			HomeTeam:  box.Teams.Home.Team.Name,
			AwayTeam:  box.Teams.Away.Team.Name,
			HomeID:    box.Teams.Home.Team.ID,
			AwayID:    box.Teams.Away.Team.ID,
			Innings:   innings,
			HomeTotal: payload.Teams.Home.Runs,
			AwayTotal: payload.Teams.Away.Runs,
		}
		body, err := marshalCachedJSON(out)
		if err != nil {
			return nil, 0, err
		}
		return body, cacheTTLForGameStatus(status, h.cfg), nil
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body, ttl)
}
