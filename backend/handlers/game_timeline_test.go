package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

const gameLinescoreJSON = `{
  "innings": [
    {"num": 1, "home": {"runs": 0}, "away": {"runs": 1}},
    {"num": 2, "home": {"runs": 2}, "away": {"runs": 0}}
  ],
  "teams": {
    "home": {"runs": 4},
    "away": {"runs": 3}
  }
}`

const gameBoxscoreTeamsOnlyJSON = `{
  "teams": {
    "home": {"team": {"id": 144, "name": "Phillies"}},
    "away": {"team": {"id": 121, "name": "Mets"}}
  }
}`

func TestGameTimeline_invalidGamePk(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/timeline", h.GameTimeline)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/bad/timeline", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestGameTimeline_success(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/game/777/linescore":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(gameLinescoreJSON))
		case "/game/777/boxscore":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(gameBoxscoreTeamsOnlyJSON))
		default:
			http.NotFound(w, r)
		}
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/timeline", h.GameTimeline)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/777/timeline", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.GameTimelineResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.GamePk != 777 || out.HomeTeam != "Phillies" || out.AwayTeam != "Mets" {
		t.Fatalf("response: %+v", out)
	}
	if len(out.Innings) != 2 || out.HomeTotal != 4 || out.AwayTotal != 3 {
		t.Fatalf("innings/totals: %+v", out)
	}
}

func TestGameTimeline_upstreamError(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "err", http.StatusBadGateway)
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/timeline", h.GameTimeline)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/1/timeline", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}
