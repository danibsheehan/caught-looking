package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

// TestFetchGameScheduleRaw_boxscoreMakesOneScheduleHit proves a cold GameBoxscore request
// coalesces its two concurrent schedule lookups (GameBoxscore's own status fetch and
// fetchGameBoxscoreRaw's status fetch) into a single upstream /schedule call.
func TestFetchGameScheduleRaw_boxscoreMakesOneScheduleHit(t *testing.T) {
	var scheduleHits atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/game/999/boxscore":
			_, _ = w.Write([]byte(minimalBoxscoreJSON))
		case strings.HasPrefix(r.URL.Path, "/schedule"):
			scheduleHits.Add(1)
			_, _ = w.Write([]byte(`{"dates":[{"games":[{"status":{"detailedState":"In Progress","abstractGameState":"Live"}}]}]}`))
		default:
			http.NotFound(w, r)
		}
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/999/boxscore", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if got := scheduleHits.Load(); got != 1 {
		t.Fatalf("schedule hits: got %d want 1", got)
	}
}

// TestFetchGameScheduleRaw_sharedAcrossBoxscoreAndStatcast proves the boxscore and Statcast
// handlers for the same game share one cached schedule lookup.
func TestFetchGameScheduleRaw_sharedAcrossBoxscoreAndStatcast(t *testing.T) {
	var scheduleHits atomic.Int32
	up := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/game/999/boxscore":
			_, _ = w.Write([]byte(minimalBoxscoreJSON))
		case r.URL.Path == "/statcast_search/csv":
			w.Header().Set("Content-Type", "text/csv")
			_, _ = w.Write([]byte(minimalStatcastCSV))
		case strings.HasPrefix(r.URL.Path, "/schedule"):
			scheduleHits.Add(1)
			_, _ = w.Write([]byte(`{"dates":[{"games":[{"status":{"detailedState":"Final","abstractGameState":"Final"},"venue":{"id":3309,"name":"Nationals Park"}}]}]}`))
		default:
			http.NotFound(w, r)
		}
	})
	h := newTestHandlers(t, up)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)
	r.Get("/games/{gamePk}/statcast", h.GameStatcast)

	rec1 := httptest.NewRecorder()
	r.ServeHTTP(rec1, httptest.NewRequest(http.MethodGet, "/games/999/boxscore", nil))
	if rec1.Code != http.StatusOK {
		t.Fatalf("boxscore status %d: %s", rec1.Code, rec1.Body.String())
	}

	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, "/games/999/statcast", nil))
	if rec2.Code != http.StatusOK {
		t.Fatalf("statcast status %d: %s", rec2.Code, rec2.Body.String())
	}

	if got := scheduleHits.Load(); got != 1 {
		t.Fatalf("schedule hits: got %d want 1 (boxscore and statcast should share the cached lookup)", got)
	}

	var statcastOut models.GameStatcastResponse
	if err := json.NewDecoder(rec2.Body).Decode(&statcastOut); err != nil {
		t.Fatal(err)
	}
	if statcastOut.VenueID != 3309 {
		t.Fatalf("VenueID: got %d want 3309", statcastOut.VenueID)
	}
}

// TestFetchGameScheduleRaw_invalidJSONNotCached proves an invalid schedule payload is not cached:
// the boxscore handler using it still returns 200 with an empty status (best-effort), and a
// direct retry of fetchGameScheduleRaw hits upstream again rather than reusing a cached failure.
func TestFetchGameScheduleRaw_invalidJSONNotCached(t *testing.T) {
	var scheduleHits atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/game/999/boxscore":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(minimalBoxscoreJSON))
		case strings.HasPrefix(r.URL.Path, "/schedule"):
			scheduleHits.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte("nope"))
		default:
			http.NotFound(w, r)
		}
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/games/999/boxscore", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.GameBoxscoreResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Status != "" {
		t.Fatalf("Status: got %q want empty (best-effort schedule failure)", out.Status)
	}
	if got := scheduleHits.Load(); got != 1 {
		t.Fatalf("schedule hits after boxscore request: got %d want 1", got)
	}

	ctx := httptest.NewRequest(http.MethodGet, "/", nil).Context()
	if _, err := h.fetchGameScheduleRaw(ctx, "999"); err == nil {
		t.Fatal("expected unmarshal error")
	}
	if got := scheduleHits.Load(); got != 2 {
		t.Fatalf("schedule hits after direct retry: got %d want 2 (invalid JSON must not be cached)", got)
	}
}
