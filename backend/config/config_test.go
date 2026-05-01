package config

import (
	"reflect"
	"slices"
	"testing"
	"time"
)

// env keys read by Load; set to "" so tests do not depend on the parent process environment.
var loadEnvKeys = []string{
	"PORT",
	"HTTP_ADDR",
	"MLB_BASE_URL",
	"ALLOWED_ORIGINS",
	"CACHE_TTL_STANDINGS",
	"CACHE_TTL_SCORES",
	"MLB_SEASON",
	"MLB_LEAGUE_IDS",
	"RATE_LIMIT_REQUESTS",
	"RATE_LIMIT_WINDOW",
	"MLB_MAX_QPS",
	"MLB_HTTP_TIMEOUT",
	"SAVANT_BASE_URL",
	"CACHE_TTL_STATCAST",
	"CACHE_TTL_PLAYER_SEARCH",
	"CACHE_SWEEP_INTERVAL",
	"CACHE_MAX_ENTRIES",
	"SAVANT_MAX_QPS",
}

func resetLoadEnv(t *testing.T) {
	t.Helper()
	for _, k := range loadEnvKeys {
		t.Setenv(k, "")
	}
}

func TestLoad_defaults(t *testing.T) {
	resetLoadEnv(t)

	got := Load()
	want := Config{
		HTTPAddr:           ":8080",
		MLBBaseURL:         "https://statsapi.mlb.com/api/v1",
		SavantBaseURL:      "https://baseballsavant.mlb.com",
		AllowedOrigins:     []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		TTLStandings:       time.Hour,
		TTLScores:          5 * time.Minute,
		TTLStatcast:        6 * time.Hour,
		TTLPlayerSearch:    3 * time.Minute,
		DefaultSeason:      2026,
		DefaultLeagueIDs:   "103,104",
		RateLimitRequests:  120,
		RateLimitWindow:    time.Minute,
		MLBMaxQPS:          20,
		MLBHTTPTimeout:     15 * time.Second,
		SavantMaxQPS:       5,
		CacheSweepInterval: 2 * time.Minute,
		CacheMaxEntries:    0,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Load() mismatch\n got: %+v\nwant: %+v", got, want)
	}
}

func TestLoad_PORT(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("PORT", "3000")

	got := Load()
	if got.HTTPAddr != ":3000" {
		t.Fatalf("HTTPAddr: got %q want :3000", got.HTTPAddr)
	}
}

func TestLoad_HTTP_ADDR(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("HTTP_ADDR", "127.0.0.1:9000")

	got := Load()
	if got.HTTPAddr != "127.0.0.1:9000" {
		t.Fatalf("HTTPAddr: got %q", got.HTTPAddr)
	}
}

func TestLoad_PORT_overrides_HTTP_ADDR(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("PORT", "3000")
	t.Setenv("HTTP_ADDR", ":4000")

	got := Load()
	if got.HTTPAddr != ":3000" {
		t.Fatalf("HTTPAddr: got %q want :3000 (PORT wins)", got.HTTPAddr)
	}
}

func TestLoad_MLB_BASE_URL_trimsTrailingSlash(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("MLB_BASE_URL", "https://example.test/api/v1/")

	got := Load()
	if got.MLBBaseURL != "https://example.test/api/v1" {
		t.Fatalf("MLBBaseURL: got %q", got.MLBBaseURL)
	}
}

func TestLoad_ALLOWED_ORIGINS(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("ALLOWED_ORIGINS", "https://a.test, https://b.test , ,https://c.test")

	got := Load()
	want := []string{"https://a.test", "https://b.test", "https://c.test"}
	if !slices.Equal(got.AllowedOrigins, want) {
		t.Fatalf("AllowedOrigins: got %#v want %#v", got.AllowedOrigins, want)
	}
}

func TestLoad_CACHE_TTL(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("CACHE_TTL_STANDINGS", "30m")
	t.Setenv("CACHE_TTL_SCORES", "10s")

	got := Load()
	if got.TTLStandings != 30*time.Minute {
		t.Fatalf("TTLStandings: got %v", got.TTLStandings)
	}
	if got.TTLScores != 10*time.Second {
		t.Fatalf("TTLScores: got %v", got.TTLScores)
	}
}

func TestLoad_invalidDurationIgnored(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("CACHE_TTL_STANDINGS", "not-a-duration")

	got := Load()
	if got.TTLStandings != time.Hour {
		t.Fatalf("TTLStandings: got %v want default 1h", got.TTLStandings)
	}
}

func TestLoad_MLB_SEASON(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("MLB_SEASON", "2025")

	got := Load()
	if got.DefaultSeason != 2025 {
		t.Fatalf("DefaultSeason: got %d", got.DefaultSeason)
	}
}

func TestLoad_invalidMLB_SEASONIgnored(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("MLB_SEASON", "twenty-twenty-five")

	got := Load()
	if got.DefaultSeason != 2026 {
		t.Fatalf("DefaultSeason: got %d want default 2026", got.DefaultSeason)
	}
}

func TestLoad_MLB_LEAGUE_IDS(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("MLB_LEAGUE_IDS", "100,200")

	got := Load()
	if got.DefaultLeagueIDs != "100,200" {
		t.Fatalf("DefaultLeagueIDs: got %q", got.DefaultLeagueIDs)
	}
}

func TestLoad_RATE_LIMIT(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("RATE_LIMIT_REQUESTS", "60")
	t.Setenv("RATE_LIMIT_WINDOW", "2m")

	got := Load()
	if got.RateLimitRequests != 60 || got.RateLimitWindow != 2*time.Minute {
		t.Fatalf("rate limit: got %d / %v", got.RateLimitRequests, got.RateLimitWindow)
	}
}

func TestLoad_invalidRATE_LIMIT_WINDOWIgnored(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("RATE_LIMIT_WINDOW", "not-a-duration")

	got := Load()
	if got.RateLimitWindow != time.Minute {
		t.Fatalf("RateLimitWindow: got %v want default 1m", got.RateLimitWindow)
	}
}

func TestLoad_MLB_MAX_QPS(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("MLB_MAX_QPS", "35.5")

	got := Load()
	if got.MLBMaxQPS != 35.5 {
		t.Fatalf("MLBMaxQPS: got %v", got.MLBMaxQPS)
	}
}

func TestLoad_cache_sweep_max_player_search_ttl(t *testing.T) {
	resetLoadEnv(t)
	t.Setenv("CACHE_SWEEP_INTERVAL", "45s")
	t.Setenv("CACHE_MAX_ENTRIES", "5000")
	t.Setenv("CACHE_TTL_PLAYER_SEARCH", "2m")

	got := Load()
	if got.CacheSweepInterval != 45*time.Second {
		t.Fatalf("CacheSweepInterval: got %v", got.CacheSweepInterval)
	}
	if got.CacheMaxEntries != 5000 {
		t.Fatalf("CacheMaxEntries: got %d", got.CacheMaxEntries)
	}
	if got.TTLPlayerSearch != 2*time.Minute {
		t.Fatalf("TTLPlayerSearch: got %v", got.TTLPlayerSearch)
	}
}
