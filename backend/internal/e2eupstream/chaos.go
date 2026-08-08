package e2eupstream

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ChaosMode selects how matched fixture paths misbehave.
type ChaosMode string

const (
	ChaosNone ChaosMode = "none"
	Chaos429  ChaosMode = "429"
	Chaos5xx  ChaosMode = "5xx"
	ChaosSlow ChaosMode = "slow"
)

const defaultSlowMS = 1500

// ChaosConfig is the JSON body for GET/PUT /_chaos.
type ChaosConfig struct {
	Mode   ChaosMode `json:"mode"`
	Paths  []string  `json:"paths"`
	SlowMS int       `json:"slowMs"`
}

// Chaos is a thread-safe controller for fixture-path failure injection.
type Chaos struct {
	mu     sync.RWMutex
	mode   ChaosMode
	paths  []string
	slowMS int
}

// NewChaos returns a disabled controller (mode none).
func NewChaos() *Chaos {
	return &Chaos{mode: ChaosNone, slowMS: defaultSlowMS}
}

// ChaosFromEnv builds a controller from E2E_CHAOS_MODE / E2E_CHAOS_PATHS / E2E_CHAOS_SLOW_MS.
func ChaosFromEnv() *Chaos {
	c := NewChaos()
	mode := ChaosMode(strings.ToLower(strings.TrimSpace(os.Getenv("E2E_CHAOS_MODE"))))
	switch mode {
	case Chaos429, Chaos5xx, ChaosSlow:
		c.mode = mode
	case "", ChaosNone:
		c.mode = ChaosNone
	default:
		c.mode = ChaosNone
	}
	if v := strings.TrimSpace(os.Getenv("E2E_CHAOS_PATHS")); v != "" {
		parts := strings.Split(v, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			if s := strings.TrimSpace(p); s != "" {
				out = append(out, s)
			}
		}
		c.paths = out
	}
	if v := strings.TrimSpace(os.Getenv("E2E_CHAOS_SLOW_MS")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			c.slowMS = n
		}
	}
	return c
}

// Snapshot returns a copy of the current config.
func (c *Chaos) Snapshot() ChaosConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	paths := append([]string(nil), c.paths...)
	return ChaosConfig{Mode: c.mode, Paths: paths, SlowMS: c.slowMS}
}

// Set replaces the active chaos config. Invalid modes become none.
func (c *Chaos) Set(cfg ChaosConfig) {
	c.mu.Lock()
	defer c.mu.Unlock()
	switch cfg.Mode {
	case Chaos429, Chaos5xx, ChaosSlow, ChaosNone:
		c.mode = cfg.Mode
	default:
		c.mode = ChaosNone
	}
	c.paths = append([]string(nil), cfg.Paths...)
	if cfg.SlowMS > 0 {
		c.slowMS = cfg.SlowMS
	}
	if c.slowMS <= 0 {
		c.slowMS = defaultSlowMS
	}
}

func (c *Chaos) matches(path string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.mode == ChaosNone || c.mode == "" {
		return false
	}
	if len(c.paths) == 0 {
		return true
	}
	for _, p := range c.paths {
		if p != "" && strings.Contains(path, p) {
			return true
		}
	}
	return false
}

// Wrap applies chaos to matched requests; non-matches pass through to next.
func (c *Chaos) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !c.matches(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		c.mu.RLock()
		mode := c.mode
		slowMS := c.slowMS
		c.mu.RUnlock()

		switch mode {
		case Chaos429:
			w.Header().Set("Retry-After", "0")
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte("e2e-upstream chaos: 429"))
		case Chaos5xx:
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte("e2e-upstream chaos: 5xx"))
		case ChaosSlow:
			if slowMS > 0 {
				timer := time.NewTimer(time.Duration(slowMS) * time.Millisecond)
				defer timer.Stop()
				select {
				case <-r.Context().Done():
					return
				case <-timer.C:
				}
			}
			next.ServeHTTP(w, r)
		default:
			next.ServeHTTP(w, r)
		}
	})
}

// ControlHandler serves GET/PUT /_chaos for runtime mode changes (Playwright).
func (c *Chaos) ControlHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead:
			writeChaosJSON(w, http.StatusOK, c.Snapshot())
		case http.MethodPut:
			var cfg ChaosConfig
			dec := json.NewDecoder(r.Body)
			dec.DisallowUnknownFields()
			if err := dec.Decode(&cfg); err != nil {
				http.Error(w, `{"error":"invalid chaos config"}`, http.StatusBadRequest)
				return
			}
			c.Set(cfg)
			writeChaosJSON(w, http.StatusOK, c.Snapshot())
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
}

func writeChaosJSON(w http.ResponseWriter, status int, cfg ChaosConfig) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(cfg)
}
