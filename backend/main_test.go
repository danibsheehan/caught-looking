package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

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
		services.NewSavantClient("http://127.0.0.1:9", 0),
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
