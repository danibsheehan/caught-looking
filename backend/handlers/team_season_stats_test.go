package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

func TestTeamSeasonStats_invalidTeamID(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/x/season-stats", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestTeamSeasonStats_success(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/teams/121/stats" {
			http.NotFound(w, r)
			return
		}
		q := r.URL.Query()
		g := q.Get("group")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		switch g {
		case "hitting":
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":20,"runs":100,"ops":0.75,"obp":0.33,"slg":0.42,"avg":0.265}}]}]}`))
		case "pitching":
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":20,"runs":80,"era":3.5,"whip":1.2,"strikeoutsPer9Inn":9.0,"walksPer9Inn":3.0}}]}]}`))
		default:
			http.Error(w, "bad group", http.StatusBadRequest)
		}
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/121/season-stats?season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.TeamSeasonStatsResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.TeamID != 121 || out.Season != 2026 {
		t.Fatalf("meta: %+v", out)
	}
	if out.Hitting.GamesPlayed != 20 || out.Pitching.Era == 0 {
		t.Fatalf("lines: hitting=%+v pitching=%+v", out.Hitting, out.Pitching)
	}
}
