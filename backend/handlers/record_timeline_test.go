package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

const scheduleOneFinalGame = `{
  "dates": [
    {
      "games": [
        {
          "officialDate": "2026-04-10",
          "gameDate": "2026-04-10T18:05:00Z",
          "status": {"abstractGameState": "Final"},
          "isTie": false,
          "teams": {
            "away": {"team": {"id": 121}, "isWinner": true},
            "home": {"team": {"id": 144}, "isWinner": false}
          }
        }
      ]
    }
  ]
}`

func TestRecordTimeline_invalidTeamID(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/record-timeline", h.RecordTimeline)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/abc/record-timeline", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestRecordTimeline_success(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/schedule" {
			http.NotFound(w, r)
			return
		}
		q := r.URL.Query()
		if q.Get("teamId") != "121" || q.Get("season") != "2026" {
			http.Error(w, "bad query", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(scheduleOneFinalGame))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/record-timeline", h.RecordTimeline)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/121/record-timeline?season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.RecordTimelineResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.TeamID != 121 || out.Season != 2026 {
		t.Fatalf("meta: %+v", out)
	}
	if len(out.Points) != 1 || out.Points[0].Result != "W" {
		t.Fatalf("points: %+v", out.Points)
	}
}

func TestParseRecordTimeline_skipsNonFinal(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[{"officialDate":"2026-04-01","gameDate":"2026-04-01T00:00:00Z","status":{"abstractGameState":"Live"},"teams":{"away":{"team":{"id":121},"isWinner":false},"home":{"team":{"id":144},"isWinner":false}}}]}]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 0 || out.Finished != 0 {
		t.Fatalf("got %+v", out)
	}
}
