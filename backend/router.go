package main

import (
	"net/http"

	"caught-looking/backend/apidocs"
	"caught-looking/backend/config"
	"caught-looking/backend/handlers"
	"caught-looking/backend/middleware"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// newRouter returns the API router (middleware + routes). Used by main and tests.
func newRouter(cfg config.Config, h *handlers.Handlers) http.Handler {
	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(middleware.RequestIDHeader)
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.Logger)
	// CORS before MaxBodyBytes so 413 (and other early rejects) still get ACAO headers.
	r.Use(middleware.CORS(cfg.AllowedOrigins))
	r.Use(middleware.MaxBodyBytes(cfg.HTTPMaxBodyBytes))
	// Large JSON (e.g. game Statcast) shrinks sharply with gzip; clients send Accept-Encoding as usual.
	if !cfg.HTTPDisableCompression {
		r.Use(chimiddleware.Compress(5,
			"application/json",
			"application/x-yaml",
			"text/yaml",
			"text/plain",
			"text/html",
		))
	}

	// Liveness: process is up. Prefer this for Cloud Run liveness/startup probes.
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	// Readiness: process-local wiring only — never probe MLB/Savant (would thrash scale-to-zero).
	r.Get("/ready", func(w http.ResponseWriter, _ *http.Request) {
		if !h.Ready() {
			http.Error(w, "not ready", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ready"))
	})
	// Prometheus scrape endpoint — outside the rate-limited API group (like /health).
	r.Handle("/metrics", promhttp.Handler())
	r.Get("/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
		apidocs.OpenAPISpec().ServeHTTP(w, r)
	})
	r.Get("/docs", apidocs.SwaggerUI().ServeHTTP)

	r.Group(func(r chi.Router) {
		// Resolves the client IP for HTTPRateLimit's key (RemoteAddr — see its doc comment).
		r.Use(chimiddleware.ClientIPFromRemoteAddr)
		r.Use(middleware.HTTPRateLimit(cfg.RateLimitRequests, cfg.RateLimitWindow))
		r.Get("/teams/{teamID}/record-timeline", h.RecordTimeline)
		r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)
		r.Get("/record-timelines/batch", h.RecordTimelinesBatch)
		r.Get("/teams", h.Teams)
		r.Get("/standings", h.Standings)
		r.Get("/leaders", h.Leaders)
		r.Get("/games/for-date", h.GamesForDate)
		r.Get("/games/{gamePk}/timeline", h.GameTimeline)
		r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)
		r.Get("/games/{gamePk}/statcast/pitches", h.GameStatcastPitches)
		r.Get("/games/{gamePk}/statcast", h.GameStatcast)
		r.Get("/players/search", h.PlayerSearch)
		r.Get("/players/current-teams", h.PlayersCurrentTeams)
		r.Get("/players/{playerID}/current-team", h.PlayerCurrentTeam)
		r.Get("/players/compare", h.PlayersCompare)
		r.Get("/players/compare/year-by-year", h.PlayersCompareYearByYear)
		r.Get("/players/compare/game-log", h.PlayersCompareGameLog)
		r.Get("/players/compare/platoon", h.PlayersComparePlatoon)
		r.Get("/league/season-baseline", h.LeagueSeasonBaseline)
	})

	return r
}
