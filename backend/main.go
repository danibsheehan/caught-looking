package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"caught-looking/backend/config"
	"caught-looking/backend/handlers"
	"caught-looking/backend/services"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatal(err)
	}
	cache := services.NewTTLCache()
	sweeperCtx, stopSweeper := context.WithCancel(context.Background())
	defer stopSweeper()
	if cfg.CacheSweepInterval > 0 {
		go cache.RunSweeper(sweeperCtx, cfg.CacheSweepInterval, cfg.CacheMaxEntries, func(format string, args ...any) {
			slog.Info("cache_sweep", "msg", fmt.Sprintf(format, args...))
		})
	}
	mlb := services.NewMLBClient(cfg.MLBBaseURL, cfg.MLBMaxQPS, cfg.MLBHTTPTimeout)
	savant := services.NewSavantClient(cfg.SavantBaseURL, cfg.SavantMaxQPS, cfg.SavantHTTPTimeout)
	h := handlers.New(cfg, cache, mlb, savant)

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           newRouter(cfg, h),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      90 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		slog.Info("listening", "addr", cfg.HTTPAddr, "mlb_base", cfg.MLBBaseURL)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	stopSweeper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("shutdown", "err", err)
	}
}
