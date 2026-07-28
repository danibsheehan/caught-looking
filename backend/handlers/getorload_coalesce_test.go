package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

func TestPlayerSearch_concurrentMissCoalesces(t *testing.T) {
	var hits atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		time.Sleep(40 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(peopleSearchJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/search", h.PlayerSearch)

	const n = 12
	var wg sync.WaitGroup
	wg.Add(n)
	errCh := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/players/search?names=Example", nil))
			if rec.Code != http.StatusOK {
				errCh <- fmt.Errorf("status %d", rec.Code)
				return
			}
			var out models.PlayersSearchResponse
			if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
				errCh <- err
				return
			}
			if len(out.People) != 1 {
				errCh <- fmt.Errorf("people=%d", len(out.People))
			}
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
	if got := hits.Load(); got != 1 {
		t.Fatalf("upstream hits: got %d want 1", got)
	}
}

func TestGamesForDate_concurrentMissCoalesces(t *testing.T) {
	var hits atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		time.Sleep(40 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(scheduleForDateJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/for-date", h.GamesForDate)

	const n = 12
	var wg sync.WaitGroup
	wg.Add(n)
	errCh := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/games/for-date?date=2026-06-15", nil))
			if rec.Code != http.StatusOK {
				errCh <- fmt.Errorf("status %d", rec.Code)
				return
			}
			var out models.GamesForDateResponse
			if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
				errCh <- err
				return
			}
			if len(out.Games) != 1 {
				errCh <- fmt.Errorf("games=%d", len(out.Games))
			}
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
	if got := hits.Load(); got != 1 {
		t.Fatalf("upstream hits: got %d want 1", got)
	}
}

func TestGameBoxscore_concurrentMissCoalesces(t *testing.T) {
	var hits atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		time.Sleep(40 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if r.URL.Path == "/schedule" {
			_, _ = w.Write([]byte(`{"dates":[{"games":[{"status":{"detailedState":"Final"}}]}]}`))
			return
		}
		_, _ = w.Write([]byte(`{"teams":{"away":{"team":{"id":1,"name":"A"},"teamStats":{"batting":{},"pitching":{},"fielding":{}},"batters":[],"pitchers":[],"players":{}},"home":{"team":{"id":2,"name":"H"},"teamStats":{"batting":{},"pitching":{},"fielding":{}},"batters":[],"pitchers":[],"players":{}}}}`))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)

	const n = 12
	var wg sync.WaitGroup
	wg.Add(n)
	errCh := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/games/555/boxscore", nil))
			if rec.Code != http.StatusOK {
				errCh <- fmt.Errorf("status %d body %s", rec.Code, rec.Body.String())
			}
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
	// boxscore raw (+ schedule for raw TTL) + outer schedule for API TTL.
	if got := hits.Load(); got != 3 {
		t.Fatalf("upstream hits: got %d want 3", got)
	}
}

func TestPlayersCompare_concurrentMissCoalesces(t *testing.T) {
	var hits atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		time.Sleep(40 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"stats":[{"splits":[{"player":{"id":1,"fullName":"A"},"stat":{"avg":".300"}}]}]}`))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/compare", h.PlayersCompare)

	const n = 12
	var wg sync.WaitGroup
	wg.Add(n)
	errCh := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/players/compare?ids=1,2&group=hitting&scope=season&season=2026", nil))
			if rec.Code != http.StatusOK {
				errCh <- fmt.Errorf("status %d body %s", rec.Code, rec.Body.String())
			}
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
	// Two players fetched in parallel per coalesced load → exactly 2 upstream calls.
	if got := hits.Load(); got != 2 {
		t.Fatalf("upstream hits: got %d want 2", got)
	}
}

func TestGameTimeline_concurrentMissCoalesces(t *testing.T) {
	var hits atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		time.Sleep(40 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		switch {
		case r.URL.Path == "/game/555/linescore":
			_, _ = w.Write([]byte(`{"innings":[{"num":1,"home":{"runs":1},"away":{"runs":0}}],"teams":{"home":{"runs":1},"away":{"runs":0}},"status":{"detailedState":"Final"}}`))
		case r.URL.Path == "/game/555/boxscore":
			_, _ = w.Write([]byte(`{"teams":{"home":{"team":{"id":2,"name":"H"}},"away":{"team":{"id":1,"name":"A"}}}}`))
		case r.URL.Path == "/schedule":
			_, _ = w.Write([]byte(`{"dates":[{"games":[{"status":{"detailedState":"Final"}}]}]}`))
		default:
			http.NotFound(w, r)
		}
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/timeline", h.GameTimeline)

	const n = 12
	var wg sync.WaitGroup
	wg.Add(n)
	errCh := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/games/555/timeline", nil))
			if rec.Code != http.StatusOK {
				errCh <- fmt.Errorf("status %d body %s", rec.Code, rec.Body.String())
			}
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
	// linescore + nested raw boxscore (+ schedule for raw TTL) once for the coalesced load.
	if got := hits.Load(); got != 3 {
		t.Fatalf("upstream hits: got %d want 3", got)
	}
}

func TestGameTimeline_reusesNestedBoxscoreRaw(t *testing.T) {
	var boxscoreHits atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		switch {
		case r.URL.Path == "/game/555/boxscore":
			boxscoreHits.Add(1)
			_, _ = w.Write([]byte(`{"teams":{"away":{"team":{"id":1,"name":"A"},"teamStats":{"batting":{},"pitching":{},"fielding":{}},"batters":[],"pitchers":[],"players":{}},"home":{"team":{"id":2,"name":"H"},"teamStats":{"batting":{},"pitching":{},"fielding":{}},"batters":[],"pitchers":[],"players":{}}}}`))
		case r.URL.Path == "/game/555/linescore":
			_, _ = w.Write([]byte(`{"innings":[{"num":1,"home":{"runs":1},"away":{"runs":0}}],"teams":{"home":{"runs":1},"away":{"runs":0}},"status":{"detailedState":"Final"}}`))
		case r.URL.Path == "/schedule":
			_, _ = w.Write([]byte(`{"dates":[{"games":[{"status":{"detailedState":"Final"}}]}]}`))
		default:
			http.NotFound(w, r)
		}
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)
	r.Get("/games/{gamePk}/timeline", h.GameTimeline)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/games/555/boxscore", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("boxscore status %d", rec.Code)
	}
	if got := boxscoreHits.Load(); got != 1 {
		t.Fatalf("boxscore upstream after boxscore: got %d want 1", got)
	}

	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, "/games/555/timeline", nil))
	if rec2.Code != http.StatusOK {
		t.Fatalf("timeline status %d: %s", rec2.Code, rec2.Body.String())
	}
	if got := boxscoreHits.Load(); got != 1 {
		t.Fatalf("boxscore upstream after timeline: got %d want 1 (nested raw reuse)", got)
	}
}
