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
		http.Error(w, "invalid gamePk", http.StatusBadRequest)
		return
	}

	cacheKey := "game-timeline:" + pkStr
	if body, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
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
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	var payload mlbLinescorePayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		http.Error(w, "upstream parse error", http.StatusBadGateway)
		return
	}

	var box mlbBoxscoreTeams
	if err := json.Unmarshal(rawBox, &box); err != nil {
		http.Error(w, "upstream boxscore parse error", http.StatusBadGateway)
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
		http.Error(w, "encode error", http.StatusInternalServerError)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLScores)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}
