package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

const defaultCacheMaxEntries = 2000

// Config holds runtime settings for the API server and upstream MLB client.
type Config struct {
	HTTPAddr       string
	MLBBaseURL     string
	SavantBaseURL  string
	AllowedOrigins []string
	TTLStandings   time.Duration
	TTLScores      time.Duration
	TTLStatcast    time.Duration // Statcast CSV per game (Savant)
	// TTLPlayerSearch caps memory for unbounded name-query keys (separate from TTLScores).
	TTLPlayerSearch   time.Duration
	DefaultSeason     int
	DefaultLeagueIDs  string
	RateLimitRequests int           // per client IP per window; 0 disables HTTP rate limiting
	RateLimitWindow   time.Duration // sliding window for RateLimitRequests
	MLBMaxQPS         float64       // token-bucket limit for outbound MLB GETs per process; 0 = unlimited
	MLBHTTPTimeout    time.Duration // per-attempt timeout for outbound MLB GETs; 0 = default (15s)
	SavantMaxQPS      float64       // token-bucket limit for outbound Savant GETs per process; 0 = unlimited
	// CacheSweepInterval runs a background sweep of expired TTL entries; 0 disables.
	CacheSweepInterval time.Duration
	// CacheMaxEntries evicts arbitrary live entries after each sweep until count <= ~90% of max; 0 disables.
	CacheMaxEntries int
	// HTTPDisableCompression skips chi gzip middleware (for debugging or odd proxies).
	HTTPDisableCompression bool
}

// Load reads configuration from environment variables with sensible defaults.
func Load() Config {
	cfg := Config{
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
		CacheMaxEntries:    defaultCacheMaxEntries,
	}

	if v := strings.TrimSpace(os.Getenv("PORT")); v != "" {
		cfg.HTTPAddr = ":" + v
	} else if v := strings.TrimSpace(os.Getenv("HTTP_ADDR")); v != "" {
		cfg.HTTPAddr = v
	}

	if v := strings.TrimSpace(os.Getenv("MLB_BASE_URL")); v != "" {
		cfg.MLBBaseURL = strings.TrimRight(v, "/")
	}

	if v := strings.TrimSpace(os.Getenv("SAVANT_BASE_URL")); v != "" {
		cfg.SavantBaseURL = strings.TrimRight(v, "/")
	}

	if v := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS")); v != "" {
		parts := strings.Split(v, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			if s := strings.TrimSpace(p); s != "" {
				out = append(out, s)
			}
		}
		if len(out) > 0 {
			cfg.AllowedOrigins = out
		}
	}

	if v := strings.TrimSpace(os.Getenv("CACHE_TTL_STANDINGS")); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.TTLStandings = d
		}
	}

	if v := strings.TrimSpace(os.Getenv("CACHE_TTL_SCORES")); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.TTLScores = d
		}
	}

	if v := strings.TrimSpace(os.Getenv("CACHE_TTL_STATCAST")); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.TTLStatcast = d
		}
	}

	if v := strings.TrimSpace(os.Getenv("CACHE_TTL_PLAYER_SEARCH")); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.TTLPlayerSearch = d
		}
	}

	if v := strings.TrimSpace(os.Getenv("MLB_SEASON")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.DefaultSeason = n
		}
	}

	if v := strings.TrimSpace(os.Getenv("MLB_LEAGUE_IDS")); v != "" {
		cfg.DefaultLeagueIDs = v
	}

	if v := strings.TrimSpace(os.Getenv("RATE_LIMIT_REQUESTS")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.RateLimitRequests = n
		}
	}

	if v := strings.TrimSpace(os.Getenv("RATE_LIMIT_WINDOW")); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.RateLimitWindow = d
		}
	}

	if v := strings.TrimSpace(os.Getenv("MLB_MAX_QPS")); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.MLBMaxQPS = f
		}
	}

	if v := strings.TrimSpace(os.Getenv("MLB_HTTP_TIMEOUT")); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.MLBHTTPTimeout = d
		}
	}

	if v := strings.TrimSpace(os.Getenv("SAVANT_MAX_QPS")); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.SavantMaxQPS = f
		}
	}

	if v := strings.TrimSpace(os.Getenv("CACHE_SWEEP_INTERVAL")); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.CacheSweepInterval = d
		}
	}

	if v := strings.TrimSpace(os.Getenv("CACHE_MAX_ENTRIES")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			cfg.CacheMaxEntries = n
		}
	}

	if v := strings.TrimSpace(strings.ToLower(os.Getenv("HTTP_DISABLE_COMPRESSION"))); v == "1" || v == "true" || v == "yes" {
		cfg.HTTPDisableCompression = true
	}

	return cfg
}
