package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestRespondGetOrLoadError_encodeVsUpstream(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	respondGetOrLoadError(rec, req, fmt.Errorf("%w: boom", errJSONEncode))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("encode: got %d want 500", rec.Code)
	}

	rec2 := httptest.NewRecorder()
	respondGetOrLoadError(rec2, req, errors.New("mlb down"))
	if rec2.Code != http.StatusBadGateway {
		t.Fatalf("upstream: got %d want 502", rec2.Code)
	}
}

func TestLoadLeagueTeamStatMaps_rejectsInvalidJSONWithoutCaching(t *testing.T) {
	var hits atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("not-json"))
	})
	h := newTestHandlers(t, mlb)

	_, err := h.loadLeagueTeamStatMaps(httptest.NewRequest(http.MethodGet, "/", nil).Context(), 2026, "hitting")
	if err == nil {
		t.Fatal("expected unmarshal error")
	}
	_, err = h.loadLeagueTeamStatMaps(httptest.NewRequest(http.MethodGet, "/", nil).Context(), 2026, "hitting")
	if err == nil {
		t.Fatal("expected unmarshal error on retry")
	}
	if got := hits.Load(); got != 2 {
		t.Fatalf("invalid JSON must not be cached: hits=%d want 2", got)
	}
}

func TestFetchTeamSeasonSchedule_rejectsInvalidJSONWithoutCaching(t *testing.T) {
	var hits atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{broken"))
	})
	h := newTestHandlers(t, mlb)

	_, err := h.fetchTeamSeasonSchedule(httptest.NewRequest(http.MethodGet, "/", nil).Context(), 121, 2026)
	if err == nil {
		t.Fatal("expected unmarshal error")
	}
	_, err = h.fetchTeamSeasonSchedule(httptest.NewRequest(http.MethodGet, "/", nil).Context(), 121, 2026)
	if err == nil {
		t.Fatal("expected unmarshal error on retry")
	}
	if got := hits.Load(); got != 2 {
		t.Fatalf("invalid JSON must not be cached: hits=%d want 2", got)
	}
}

func TestLeagueSeasonBaseline_invalidUpstreamJSON(t *testing.T) {
	h := newTestHandlers(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("nope"))
	}))
	r := chi.NewRouter()
	r.Get("/league/season-baseline", h.LeagueSeasonBaseline)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/league/season-baseline?season=2026&group=hitting", nil))
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d want 502", rec.Code)
	}
}

func TestMarshalCachedJSON_wrapsEncodeError(t *testing.T) {
	_, err := marshalCachedJSON(make(chan int))
	if !errors.Is(err, errJSONEncode) {
		t.Fatalf("got %v", err)
	}
}
