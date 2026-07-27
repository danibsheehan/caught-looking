package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

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
	if body, ok := h.cache.Get(cacheKey); ok {
		writeJSONBytes(w, body)
		return
	}

	ctx := r.Context()
	g, gctx := errgroup.WithContext(ctx)
	var raw []byte
	var rawBox []byte
	g.Go(func() error {
		var err error
		raw, err = h.mlb.Get(gctx, "/game/"+pkStr+"/linescore")
		return err
	})
	g.Go(func() error {
		var err error
		rawBox, err = h.mlb.Get(gctx, "/game/"+pkStr+"/boxscore")
		return err
	})
	if err := g.Wait(); err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	var payload mlbLinescorePayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		respondUpstreamJSONParseError(w)
		return
	}

	var box mlbBoxscoreTeams
	if err := json.Unmarshal(rawBox, &box); err != nil {
		respondAPIError(w, http.StatusBadGateway, "upstream boxscore parse error")
		return
	}

	innings := make([]models.InningScore, 0, len(payload.Innings))
	for _, inn := range payload.Innings {
		innings = append(innings, models.InningScore{
			Inning:   inn.Num,
			HomeRuns: inn.Home.Runs,
			AwayRuns: inn.Away.Runs,
		})
	}

	out := models.GameTimelineResponse{
		GamePk:    gamePk,
		HomeTeam:  box.Teams.Home.Team.Name,
		AwayTeam:  box.Teams.Away.Team.Name,
		HomeID:    box.Teams.Home.Team.ID,
		AwayID:    box.Teams.Away.Team.ID,
		Innings:   innings,
		HomeTotal: payload.Teams.Home.Runs,
		AwayTotal: payload.Teams.Away.Runs,
	}

	body, err := json.Marshal(out)
	if err != nil {
		respondJSONEncodeError(w)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLLiveScores)
	writeJSONBytes(w, body)
}
