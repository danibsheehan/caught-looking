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
	cache := services.NewTTLCache()
	mlb := services.NewMLBClient(cfg.MLBBaseURL, cfg.MLBMaxQPS, cfg.MLBHTTPTimeout)
	savant := services.NewSavantClient(cfg.SavantBaseURL, cfg.SavantMaxQPS)
	h := handlers.New(cfg, cache, mlb, savant)

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           newRouter(cfg, h),
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
