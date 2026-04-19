package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

const leagueBaselineHittingJSON = `{"stats":[{"splits":[
  {"league":{"id":103},"team":{"id":121},"stat":{"gamesPlayed":10,"hits":90,"atBats":300,"totalBases":150,"baseOnBalls":40,"hitByPitch":5,"sacFlies":5}},
  {"league":{"id":104},"team":{"id":120},"stat":{"gamesPlayed":10,"hits":80,"atBats":280,"totalBases":140,"baseOnBalls":35,"hitByPitch":4,"sacFlies":4}}
]}]}`

const leagueBaselinePitchingJSON = `{"stats":[{"splits":[
  {"league":{"id":103},"team":{"id":121},"stat":{"gamesPlayed":10,"earnedRuns":20,"inningsPitched":"45.0"}}
]}]}`

func TestLeagueSeasonBaseline_validation(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/league/season-baseline", h.LeagueSeasonBaseline)

	tests := []struct {
		path string
	}{
		{"/league/season-baseline?season=1800"},
		{"/league/season-baseline?group=fielding"},
	}
	for _, tt := range tests {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, tt.path, nil)
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d", tt.path, rec.Code)
		}
	}
}

func TestLeagueSeasonBaseline_hitting(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/stats" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(leagueBaselineHittingJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/league/season-baseline", h.LeagueSeasonBaseline)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/league/season-baseline?season=2026&group=hitting", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.LeagueSeasonBaselineResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Group != "hitting" || out.Season != 2026 || out.Ops <= 0 {
		t.Fatalf("response: %+v", out)
	}
}

func TestLeagueSeasonBaseline_pitching(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/stats" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(leagueBaselinePitchingJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/league/season-baseline", h.LeagueSeasonBaseline)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/league/season-baseline?season=2026&group=pitching", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.LeagueSeasonBaselineResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Group != "pitching" || out.Era <= 0 {
		t.Fatalf("response: %+v", out)
	}
}

func TestLeagueSeasonBaseline_upstreamError(t *testing.T) {
	h := newTestHandlers(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "fail", http.StatusBadGateway)
	}))
	r := chi.NewRouter()
	r.Get("/league/season-baseline", h.LeagueSeasonBaseline)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/league/season-baseline", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}
