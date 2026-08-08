package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"caught-looking/backend/config"
	"caught-looking/backend/handlers"
	"caught-looking/backend/services"
)

func TestHealth(t *testing.T) {
	cfg := config.Config{
		AllowedOrigins: []string{"http://localhost:5173"},
	}
	h := handlers.New(
		cfg,
		services.NewTTLCache(),
		services.NewMLBClient("http://127.0.0.1:9", 0, 0),
		services.NewSavantClient("http://127.0.0.1:9", 0, 0),
	)
	srv := httptest.NewServer(newRouter(cfg, h))
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d want %d", res.StatusCode, http.StatusOK)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "ok" {
		t.Fatalf("body: got %q want %q", body, "ok")
	}
	if got := res.Header.Get("X-Request-ID"); got == "" {
		t.Fatal("expected X-Request-ID on /health response")
	}
}

func TestReady(t *testing.T) {
	cfg := config.Config{
		AllowedOrigins: []string{"http://localhost:5173"},
	}
	h := handlers.New(
		cfg,
		services.NewTTLCache(),
		services.NewMLBClient("http://127.0.0.1:9", 0, 0),
		services.NewSavantClient("http://127.0.0.1:9", 0, 0),
	)
	srv := httptest.NewServer(newRouter(cfg, h))
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/ready")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d want %d", res.StatusCode, http.StatusOK)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "ready" {
		t.Fatalf("body: got %q want %q", body, "ready")
	}
	if got := res.Header.Get("X-Request-ID"); got == "" {
		t.Fatal("expected X-Request-ID on /ready response")
	}
}

func TestReady_notReadyWhenMiswired(t *testing.T) {
	cfg := config.Config{
		AllowedOrigins: []string{"http://localhost:5173"},
	}
	// Missing Savant client — process invariant failure, not an upstream call.
	h := handlers.New(
		cfg,
		services.NewTTLCache(),
		services.NewMLBClient("http://127.0.0.1:9", 0, 0),
		nil,
	)
	srv := httptest.NewServer(newRouter(cfg, h))
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/ready")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })

	if res.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status: got %d want %d", res.StatusCode, http.StatusServiceUnavailable)
	}
}

func TestRequestIDHeaderOnAPIError(t *testing.T) {
	cfg := config.Config{
		AllowedOrigins:     []string{"http://localhost:5173"},
		RateLimitRequests:  1,
		RateLimitWindow:    time.Minute,
		HTTPMaxBodyBytes:   64 << 10,
		TTLStandings:       time.Hour,
		TTLScores:          5 * time.Minute,
		TTLLiveScores:      45 * time.Second,
		TTLStatcast:        6 * time.Hour,
		TTLPlayerSearch:    3 * time.Minute,
		CacheSweepInterval: time.Hour,
		CacheMaxEntries:    100,
	}
	h := handlers.New(
		cfg,
		services.NewTTLCache(),
		services.NewMLBClient("http://127.0.0.1:9", 0, 0),
		services.NewSavantClient("http://127.0.0.1:9", 0, 0),
	)
	srv := httptest.NewServer(newRouter(cfg, h))
	t.Cleanup(srv.Close)

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/standings?season=not-a-year", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("X-Request-ID", "client-corr-1")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })

	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("status: got %d want %d", res.StatusCode, http.StatusBadRequest)
	}
	if got := res.Header.Get("X-Request-ID"); got != "client-corr-1" {
		t.Fatalf("X-Request-ID: got %q want client-corr-1 (chi should echo/accept inbound id)", got)
	}
}

func TestMetrics(t *testing.T) {
	cfg := config.Config{
		AllowedOrigins: []string{"http://localhost:5173"},
	}
	h := handlers.New(
		cfg,
		services.NewTTLCache(),
		services.NewMLBClient("http://127.0.0.1:9", 0, 0),
		services.NewSavantClient("http://127.0.0.1:9", 0, 0),
	)
	srv := httptest.NewServer(newRouter(cfg, h))
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/metrics")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d want %d", res.StatusCode, http.StatusOK)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), "go_goroutines") {
		t.Fatalf("expected default Go collector metrics, got %q", truncateForTest(string(body), 200))
	}
	for _, name := range []string{
		"caught_looking_cache_requests_total",
		"caught_looking_cache_coalesce_total",
		"caught_looking_upstream_http_total",
		"caught_looking_http_request_duration_seconds",
		"caught_looking_cache_load_duration_seconds",
		"caught_looking_upstream_http_duration_seconds",
	} {
		if !strings.Contains(string(body), name) {
			t.Fatalf("expected custom metric %q in /metrics, got %q", name, truncateForTest(string(body), 400))
		}
	}
}

func truncateForTest(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func TestOpenAPISpec(t *testing.T) {
	cfg := config.Config{
		AllowedOrigins: []string{"http://localhost:5173"},
	}
	h := handlers.New(
		cfg,
		services.NewTTLCache(),
		services.NewMLBClient("http://127.0.0.1:9", 0, 0),
		services.NewSavantClient("http://127.0.0.1:9", 0, 0),
	)
	srv := httptest.NewServer(newRouter(cfg, h))
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/openapi.yaml")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d want %d", res.StatusCode, http.StatusOK)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), "openapi: 3.0.3") {
		t.Fatalf("body missing openapi version declaration: %q", body)
	}
}

func TestSwaggerUI(t *testing.T) {
	cfg := config.Config{
		AllowedOrigins: []string{"http://localhost:5173"},
	}
	h := handlers.New(
		cfg,
		services.NewTTLCache(),
		services.NewMLBClient("http://127.0.0.1:9", 0, 0),
		services.NewSavantClient("http://127.0.0.1:9", 0, 0),
	)
	srv := httptest.NewServer(newRouter(cfg, h))
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/docs")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d want %d", res.StatusCode, http.StatusOK)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), "SwaggerUIBundle") {
		t.Fatalf("body missing Swagger UI bootstrap script")
	}
}

func TestBodyTooLargeIncludesCORSHeaders(t *testing.T) {
	cfg := config.Config{
		AllowedOrigins:   []string{"http://localhost:5173"},
		HTTPMaxBodyBytes: 64,
	}
	h := handlers.New(
		cfg,
		services.NewTTLCache(),
		services.NewMLBClient("http://127.0.0.1:9", 0, 0),
		services.NewSavantClient("http://127.0.0.1:9", 0, 0),
	)
	router := newRouter(cfg, h)

	// Drive the router directly so Content-Length is preserved (http.Client may
	// strip GET bodies / Content-Length and never hit the early 413 path).
	body := strings.Repeat("x", 200)
	req := httptest.NewRequest(http.MethodGet, "/teams", strings.NewReader(body))
	req.Header.Set("Origin", "http://localhost:5173")
	req.ContentLength = int64(len(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status: got %d want %d", rec.Code, http.StatusRequestEntityTooLarge)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("Access-Control-Allow-Origin: got %q want %q", got, "http://localhost:5173")
	}
}

func TestRateLimitIgnoresForwardedForSpoofing(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/teams" {
			t.Fatalf("unexpected upstream path: %s", r.URL.String())
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"teams":[{"id":147,"name":"New York Yankees","abbreviation":"NYY","teamName":"Yankees","active":true,"league":{"id":103,"name":"American League"},"division":{"id":201,"name":"American League East"}}]}`))
	}))
	t.Cleanup(upstream.Close)

	cfg := config.Config{
		AllowedOrigins:    []string{"http://localhost:5173"},
		TTLStandings:      time.Hour,
		RateLimitRequests: 1,
		RateLimitWindow:   time.Minute,
	}
	h := handlers.New(
		cfg,
		services.NewTTLCache(),
		services.NewMLBClient(upstream.URL, 0, 0),
		services.NewSavantClient("http://127.0.0.1:9", 0, 0),
	)
	srv := httptest.NewServer(newRouter(cfg, h))
	t.Cleanup(srv.Close)

	first, err := http.NewRequest(http.MethodGet, srv.URL+"/teams", nil)
	if err != nil {
		t.Fatal(err)
	}
	first.Header.Set("X-Forwarded-For", "198.51.100.10")
	res, err := srv.Client().Do(first)
	if err != nil {
		t.Fatal(err)
	}
	_ = res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("first status: got %d want %d", res.StatusCode, http.StatusOK)
	}

	second, err := http.NewRequest(http.MethodGet, srv.URL+"/teams", nil)
	if err != nil {
		t.Fatal(err)
	}
	second.Header.Set("X-Forwarded-For", "203.0.113.20")
	res, err = srv.Client().Do(second)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })
	if res.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("second status: got %d want %d", res.StatusCode, http.StatusTooManyRequests)
	}
}
