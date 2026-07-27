package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"caught-looking/backend/config"
	"caught-looking/backend/services"
)

func testConfig() config.Config {
	return config.Config{
		HTTPAddr:           ":8080",
		DefaultSeason:      2026,
		DefaultLeagueIDs:   "103,104",
		TTLScores:          time.Hour,
		TTLStandings:       time.Hour,
		TTLStatcast:        time.Hour,
		TTLPlayerSearch:    time.Hour,
		CacheSweepInterval: 0,
		CacheMaxEntries:    0,
	}
}

func newTestHandlers(t *testing.T, mlb http.Handler) *Handlers {
	t.Helper()
	srv := httptest.NewServer(mlb)
	t.Cleanup(srv.Close)
	return New(
		testConfig(),
		services.NewTTLCache(),
		services.NewMLBClient(srv.URL, 0, 0),
		services.NewSavantClient(srv.URL, 0, 0),
	)
}
