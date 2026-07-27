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
	"caught-looking/backend/services"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatal(err)
	}
	cache := services.NewTTLCache()
	sweeperCtx, stopSweeper := context.WithCancel(context.Background())
	defer stopSweeper()
	if cfg.CacheSweepInterval > 0 {
		go cache.RunSweeper(sweeperCtx, cfg.CacheSweepInterval, cfg.CacheMaxEntries, log.Printf)
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
		log.Printf("listening on %s (MLB base %s)", cfg.HTTPAddr, cfg.MLBBaseURL)
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
		log.Printf("shutdown: %v", err)
	}
}
