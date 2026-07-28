package config

import (
	"fmt"
	"log"
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
	// TTLLiveScores is a short TTL for live/today scoreboard and in-game boxscore/timeline.
	TTLLiveScores time.Duration
	// TTLPlayerSearch caps memory for unbounded name-query keys (separate from TTLScores).
	TTLPlayerSearch   time.Duration
	DefaultSeason     int
	DefaultLeagueIDs  string
	RateLimitRequests int           // per client IP per window; 0 disables HTTP rate limiting
	RateLimitWindow   time.Duration // sliding window for RateLimitRequests
	MLBMaxQPS         float64       // token-bucket limit for outbound MLB GETs per process; 0 = unlimited
	MLBHTTPTimeout    time.Duration // per-attempt timeout for outbound MLB GETs; 0 = default (15s)
	SavantMaxQPS      float64       // token-bucket limit for outbound Savant GETs per process; 0 = unlimited
	SavantHTTPTimeout time.Duration // per-attempt timeout for outbound Savant GETs; 0 = default (30s)
	// CacheSweepInterval runs a background sweep of expired TTL entries; 0 disables.
	CacheSweepInterval time.Duration
	// CacheMaxEntries evicts arbitrary live entries after each sweep until count <= ~90% of max; 0 disables.
	CacheMaxEntries int
	// HTTPDisableCompression skips chi gzip middleware (for debugging or odd proxies).
	HTTPDisableCompression bool
}

// Load reads configuration from environment variables with sensible defaults.
// Invalid env values are ignored (defaults kept) and logged so misconfig is visible.
func Load() Config {
	cfg := Config{
		HTTPAddr:           ":8080",
		MLBBaseURL:         "https://statsapi.mlb.com/api/v1",
		SavantBaseURL:      "https://baseballsavant.mlb.com",
		AllowedOrigins:     []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		TTLStandings:       time.Hour,
		TTLScores:          5 * time.Minute,
		TTLStatcast:        6 * time.Hour,
		TTLLiveScores:      45 * time.Second,
		TTLPlayerSearch:    3 * time.Minute,
		DefaultSeason:      time.Now().Year(),
		DefaultLeagueIDs:   "103,104",
		RateLimitRequests:  120,
		RateLimitWindow:    time.Minute,
		MLBMaxQPS:          20,
		MLBHTTPTimeout:     15 * time.Second,
		SavantMaxQPS:       5,
		SavantHTTPTimeout:  30 * time.Second,
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

	parseDurationEnv("CACHE_TTL_STANDINGS", &cfg.TTLStandings)
	parseDurationEnv("CACHE_TTL_SCORES", &cfg.TTLScores)
	parseDurationEnv("CACHE_TTL_STATCAST", &cfg.TTLStatcast)
	parseDurationEnv("CACHE_TTL_LIVE_SCORES", &cfg.TTLLiveScores)
	parseDurationEnv("CACHE_TTL_PLAYER_SEARCH", &cfg.TTLPlayerSearch)
	parseDurationEnv("RATE_LIMIT_WINDOW", &cfg.RateLimitWindow)
	parseDurationEnv("MLB_HTTP_TIMEOUT", &cfg.MLBHTTPTimeout)
	parseDurationEnv("SAVANT_HTTP_TIMEOUT", &cfg.SavantHTTPTimeout)
	parseDurationEnv("CACHE_SWEEP_INTERVAL", &cfg.CacheSweepInterval)

	if v := strings.TrimSpace(os.Getenv("MLB_SEASON")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.DefaultSeason = n
		} else {
			log.Printf("config: ignoring invalid MLB_SEASON=%q: %v", v, err)
		}
	}

	if v := strings.TrimSpace(os.Getenv("MLB_LEAGUE_IDS")); v != "" {
		cfg.DefaultLeagueIDs = v
	}

	if v := strings.TrimSpace(os.Getenv("RATE_LIMIT_REQUESTS")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.RateLimitRequests = n
		} else {
			log.Printf("config: ignoring invalid RATE_LIMIT_REQUESTS=%q: %v", v, err)
		}
	}

	if v := strings.TrimSpace(os.Getenv("MLB_MAX_QPS")); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.MLBMaxQPS = f
		} else {
			log.Printf("config: ignoring invalid MLB_MAX_QPS=%q: %v", v, err)
		}
	}

	if v := strings.TrimSpace(os.Getenv("SAVANT_MAX_QPS")); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.SavantMaxQPS = f
		} else {
			log.Printf("config: ignoring invalid SAVANT_MAX_QPS=%q: %v", v, err)
		}
	}

	if v := strings.TrimSpace(os.Getenv("CACHE_MAX_ENTRIES")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			cfg.CacheMaxEntries = n
		} else {
			log.Printf("config: ignoring invalid CACHE_MAX_ENTRIES=%q", v)
		}
	}

	if v := strings.TrimSpace(strings.ToLower(os.Getenv("HTTP_DISABLE_COMPRESSION"))); v == "1" || v == "true" || v == "yes" {
		cfg.HTTPDisableCompression = true
	}

	return cfg
}

func parseDurationEnv(key string, dst *time.Duration) {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		log.Printf("config: ignoring invalid %s=%q: %v", key, v, err)
		return
	}
	*dst = d
}

// Validate checks loaded config for values that would break the server or upstream clients.
func (c Config) Validate() error {
	var errs []string
	if strings.TrimSpace(c.HTTPAddr) == "" {
		errs = append(errs, "HTTP_ADDR is empty")
	}
	if strings.TrimSpace(c.MLBBaseURL) == "" {
		errs = append(errs, "MLB_BASE_URL is empty")
	}
	if strings.TrimSpace(c.SavantBaseURL) == "" {
		errs = append(errs, "SAVANT_BASE_URL is empty")
	}
	if c.DefaultSeason < 1900 || c.DefaultSeason > 2100 {
		errs = append(errs, fmt.Sprintf("MLB_SEASON out of range: %d", c.DefaultSeason))
	}
	if c.RateLimitRequests < 0 {
		errs = append(errs, "RATE_LIMIT_REQUESTS must be >= 0")
	}
	if c.RateLimitRequests > 0 && c.RateLimitWindow <= 0 {
		errs = append(errs, "RATE_LIMIT_WINDOW must be > 0 when RATE_LIMIT_REQUESTS > 0")
	}
	if c.MLBMaxQPS < 0 {
		errs = append(errs, "MLB_MAX_QPS must be >= 0")
	}
	if c.SavantMaxQPS < 0 {
		errs = append(errs, "SAVANT_MAX_QPS must be >= 0")
	}
	if c.CacheMaxEntries < 0 {
		errs = append(errs, "CACHE_MAX_ENTRIES must be >= 0")
	}
	if len(errs) == 0 {
		return nil
	}
	return fmt.Errorf("invalid config: %s", strings.Join(errs, "; "))
}
