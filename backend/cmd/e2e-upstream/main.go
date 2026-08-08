// Command e2e-upstream serves MLB/Savant fixtures for contract Playwright.
// Point the API at it with MLB_BASE_URL and SAVANT_BASE_URL.
// Optional chaos: E2E_CHAOS_MODE=429|5xx|slow, E2E_CHAOS_PATHS=comma,path,prefixes,
// or PUT /_chaos at runtime (see frontend/e2e/chaos.contract.spec.ts).
package main

import (
	"flag"
	"log"
	"net/http"
	"time"

	"caught-looking/backend/internal/e2eupstream"
)

func main() {
	addr := flag.String("addr", ":18081", "listen address")
	flag.Parse()

	srv := &http.Server{
		Addr:              *addr,
		Handler:           e2eupstream.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("e2e-upstream listening on %s (chaos control on /_chaos)", *addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
