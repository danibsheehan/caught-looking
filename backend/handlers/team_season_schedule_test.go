package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestTeamSeasonSchedule_sharedBetweenTimelineAndVenue(t *testing.T) {
	var scheduleHits atomic.Int32
	// Include scores so venue parsing counts the game.
	const sched = `{
  "dates":[{
    "games":[{
      "officialDate":"2026-04-01",
      "gameDate":"2026-04-01T17:05:00Z",
      "status":{"abstractGameState":"Final","detailedState":"Final"},
      "isTie":false,
      "teams":{
        "away":{"team":{"id":147},"isWinner":false,"score":2},
        "home":{"team":{"id":121},"isWinner":true,"score":5}
      }
    }]
  }]
}`
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/schedule" {
			http.NotFound(w, r)
			return
		}
		scheduleHits.Add(1)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(sched))
	})
	h := newTestHandlers(t, mlb)

	r := chi.NewRouter()
	r.Get("/teams/{teamID}/record-timeline", h.RecordTimeline)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/teams/121/record-timeline?season=2026", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("timeline: %d %s", rec.Code, rec.Body.String())
	}

	venue, err := h.fetchTeamVenueSplitsFromSchedule(context.Background(), 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if venue.Home.Games != 1 {
		t.Fatalf("venue home games: %+v", venue.Home)
	}
	if got := scheduleHits.Load(); got != 1 {
		t.Fatalf("schedule hits: got %d want 1", got)
	}
}
