package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds runtime settings for the API server and upstream MLB client.
type Config struct {
	HTTPAddr         string
	MLBBaseURL       string
	AllowedOrigins   []string
	TTLStandings     time.Duration
	TTLScores        time.Duration
	DefaultSeason    int
	DefaultLeagueIDs string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() Config {
	cfg := Config{
		HTTPAddr:         ":8080",
		MLBBaseURL:       "https://statsapi.mlb.com/api/v1",
		AllowedOrigins:   []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		TTLStandings:     time.Hour,
		TTLScores:        5 * time.Minute,
		DefaultSeason:    2026,
		DefaultLeagueIDs: "103,104",
	}

	if v := strings.TrimSpace(os.Getenv("PORT")); v != "" {
		cfg.HTTPAddr = ":" + v
	} else if v := strings.TrimSpace(os.Getenv("HTTP_ADDR")); v != "" {
		cfg.HTTPAddr = v
	}

	if v := strings.TrimSpace(os.Getenv("MLB_BASE_URL")); v != "" {
		cfg.MLBBaseURL = strings.TrimRight(v, "/")
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

	if v := strings.TrimSpace(os.Getenv("MLB_SEASON")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.DefaultSeason = n
		}
	}

	if v := strings.TrimSpace(os.Getenv("MLB_LEAGUE_IDS")); v != "" {
		cfg.DefaultLeagueIDs = v
	}

	return cfg
}
