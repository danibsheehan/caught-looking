package main

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// Ensures the same chi Compress settings used in newRouter yield gzip for large JSON when the client accepts it.
func TestCompressMiddleware_gzipLargeJSON(t *testing.T) {
	r := chi.NewRouter()
	r.Use(chimiddleware.Compress(5, "application/json"))
	r.Get("/j", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"x":"`+strings.Repeat("a", 4096)+`"}`)
	})
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/j", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Accept-Encoding", "gzip")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status: %d", res.StatusCode)
	}
	if got := res.Header.Get("Content-Encoding"); got != "gzip" {
		t.Fatalf("Content-Encoding: got %q want gzip", got)
	}
	gr, err := gzip.NewReader(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	defer gr.Close()
	b, err := io.ReadAll(gr)
	if err != nil {
		t.Fatal(err)
	}
	if len(b) < 100 {
		t.Fatalf("decoded body too short: %d", len(b))
	}
}
