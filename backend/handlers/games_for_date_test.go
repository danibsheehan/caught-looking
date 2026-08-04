package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

const scheduleForDateJSON = `{
  "dates": [
    {
      "date": "2026-06-15",
      "games": [
        {
          "gamePk": 999001,
          "officialDate": "2026-06-15",
          "status": {"detailedState": "Final"},
          "teams": {
            "away": {"team": {"id": 121, "name": "Mets"}, "score": 5},
            "home": {"team": {"id": 144, "name": "Phillies"}, "score": 4}
          }
        }
      ]
    }
  ]
}`

func TestGamesForDate_validation(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/games/for-date", h.GamesForDate)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/for-date?date=06-15-2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad date: status %d", rec.Code)
	}

	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/games/for-date?date=2026-06-15&teamId=xx", nil)
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("bad teamId: status %d", rec2.Code)
	}
}

func TestGamesForDate_success(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/schedule" {
			http.NotFound(w, r)
			return
		}
		if r.URL.Query().Get("date") != "2026-06-15" {
			http.Error(w, "bad date", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(scheduleForDateJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/for-date", h.GamesForDate)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/for-date?date=2026-06-15", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "public, max-age=3600" {
		// Settled historical date board uses TTLStandings (1h) via cacheTTLForDateGames.
		t.Fatalf("Cache-Control: got %q want public, max-age=3600", cc)
	}
	var out models.GamesForDateResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Date != "2026-06-15" || len(out.Games) != 1 {
		t.Fatalf("response: %+v", out)
	}
	if out.Games[0].GamePk != 999001 || out.Games[0].AwayTeam != "Mets" {
		t.Fatalf("game: %+v", out.Games[0])
	}
}

func TestGamesForDate_abstractFinalWithoutDetailed(t *testing.T) {
	const abstractOnly = `{
  "dates": [{
    "date": "2026-06-15",
    "games": [{
      "gamePk": 999002,
      "officialDate": "2026-06-15",
      "status": {"abstractGameState": "Final"},
      "teams": {
        "away": {"team": {"id": 121, "name": "Mets"}, "score": 5},
        "home": {"team": {"id": 144, "name": "Phillies"}, "score": 4}
      }
    }]
  }]
}`
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(abstractOnly))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/for-date", h.GamesForDate)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/games/for-date?date=2026-06-15", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.GamesForDateResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if len(out.Games) != 1 || out.Games[0].Status != "Final" {
		t.Fatalf("want Status Final from abstractGameState, got %+v", out.Games)
	}
}
