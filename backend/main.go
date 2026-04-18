package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"caught-looking/backend/config"
	"caught-looking/backend/handlers"
	"caught-looking/backend/middleware"
	"caught-looking/backend/services"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := config.Load()
	cache := services.NewTTLCache()
	mlb := services.NewMLBClient(cfg.MLBBaseURL)
	h := handlers.New(cfg, cache, mlb)

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
	r.Get("/teams/{teamID}/record-timeline", h.RecordTimeline)
	r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)
	r.Get("/record-timelines/batch", h.RecordTimelinesBatch)
	r.Get("/teams", h.Teams)
	r.Get("/standings", h.Standings)
	r.Get("/games/for-date", h.GamesForDate)
	r.Get("/games/{gamePk}/timeline", h.GameTimeline)
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)
	r.Get("/players/search", h.PlayerSearch)
	r.Get("/players/compare", h.PlayersCompare)

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("listening on %s (MLB base %s)", cfg.HTTPAddr, cfg.MLBBaseURL)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
