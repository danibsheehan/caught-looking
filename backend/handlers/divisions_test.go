package handlers

import (
	"context"
	"net/http"
	"sync/atomic"
	"testing"
	"time"
)

const divisionsUpstreamJSON = `{"divisions":[{"id":201,"name":"NL East"},{"id":202,"name":"NL Central"}]}`

func TestLoadDivisionNames_success(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/divisions" || r.URL.Query().Get("sportId") != "1" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(divisionsUpstreamJSON))
	})
	h := newTestHandlers(t, mlb)

	m, err := h.loadDivisionNames(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if m[201] != "NL East" || m[202] != "NL Central" {
		t.Fatalf("map: %#v", m)
	}
}

func TestLoadDivisionNames_usesCacheOnSecondCall(t *testing.T) {
	var calls atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/divisions" || r.URL.Query().Get("sportId") != "1" {
			http.NotFound(w, r)
			return
		}
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(divisionsUpstreamJSON))
	})
	h := newTestHandlers(t, mlb)

	if _, err := h.loadDivisionNames(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := h.loadDivisionNames(context.Background()); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 1 {
		t.Fatalf("expected 1 upstream GET, got %d", calls.Load())
	}
}

func TestLoadDivisionNames_mlbError(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusInternalServerError)
	})
	h := newTestHandlers(t, mlb)

	_, err := h.loadDivisionNames(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestLoadDivisionNames_invalidUpstreamJSON(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`not json`))
	})
	h := newTestHandlers(t, mlb)

	_, err := h.loadDivisionNames(context.Background())
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestLoadDivisionNames_corruptCacheEntry(t *testing.T) {
	h := newTestHandlers(t, http.HandlerFunc(http.NotFoundHandler().ServeHTTP))
	h.cache.Set(divisionNamesCacheKey, []byte(`not json`), time.Hour)

	_, err := h.loadDivisionNames(context.Background())
	if err == nil {
		t.Fatal("expected unmarshal error")
	}
}

func TestLoadDivisionNames_emptyDivisions(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"divisions":[]}`))
	})
	h := newTestHandlers(t, mlb)

	m, err := h.loadDivisionNames(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(m) != 0 {
		t.Fatalf("expected empty map, got %#v", m)
	}
	// Cached empty slice still satisfies later reads without MLB.
	h2 := New(testConfig(), h.cache, h.mlb)
	m2, err := h2.loadDivisionNames(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(m2) != 0 {
		t.Fatalf("expected empty map from cache, got %#v", m2)
	}
}
