package main

import (
	"net/http"

	"caught-looking/backend/config"
	"caught-looking/backend/handlers"
	"caught-looking/backend/middleware"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// newRouter returns the API router (middleware + routes). Used by main and tests.
func newRouter(cfg config.Config, h *handlers.Handlers) http.Handler {
	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.Logger)
	r.Use(middleware.CORS(cfg.AllowedOrigins))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Group(func(r chi.Router) {
		r.Use(middleware.HTTPRateLimit(cfg.RateLimitRequests, cfg.RateLimitWindow))
		r.Get("/teams/{teamID}/record-timeline", h.RecordTimeline)
		r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)
		r.Get("/record-timelines/batch", h.RecordTimelinesBatch)
		r.Get("/teams", h.Teams)
		r.Get("/standings", h.Standings)
		r.Get("/games/for-date", h.GamesForDate)
		r.Get("/games/{gamePk}/timeline", h.GameTimeline)
		r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)
		r.Get("/games/{gamePk}/statcast/pitches", h.GameStatcastPitches)
		r.Get("/games/{gamePk}/statcast", h.GameStatcast)
		r.Get("/players/search", h.PlayerSearch)
		r.Get("/players/{playerID}/current-team", h.PlayerCurrentTeam)
		r.Get("/players/compare", h.PlayersCompare)
		r.Get("/players/compare/year-by-year", h.PlayersCompareYearByYear)
		r.Get("/players/compare/game-log", h.PlayersCompareGameLog)
		r.Get("/league/season-baseline", h.LeagueSeasonBaseline)
	})

	return r
}
