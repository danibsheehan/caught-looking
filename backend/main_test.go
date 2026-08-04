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
