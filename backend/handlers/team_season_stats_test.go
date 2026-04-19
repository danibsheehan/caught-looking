package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
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

func TestTeamSeasonStats_invalidTeamID_zero(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/0/season-stats", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestTeamSeasonStats_invalidSeason(t *testing.T) {
	tests := []struct {
		query string
	}{
		{"season=abc"},
		{"season=1899"},
		{"season=2101"},
	}
	for _, tc := range tests {
		h := newTestHandlers(t, http.NotFoundHandler())
		r := chi.NewRouter()
		r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/teams/121/season-stats?"+tc.query, nil)
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("query %q: status %d", tc.query, rec.Code)
		}
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

func TestTeamSeasonStats_usesCache(t *testing.T) {
	var mlbCalls atomic.Int32
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mlbCalls.Add(1)
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
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":1,"runs":1,"ops":0.1,"obp":0.2,"slg":0.3,"avg":0.4}}]}]}`))
		case "pitching":
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":1,"runs":1,"era":2.0,"whip":1.0,"strikeoutsPer9Inn":8.0,"walksPer9Inn":2.0}}]}]}`))
		default:
			http.Error(w, "bad group", http.StatusBadRequest)
		}
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)

	reqURL := "/teams/121/season-stats?season=2025"
	for i := 0; i < 2; i++ {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, reqURL, nil)
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("iter %d: status %d: %s", i, rec.Code, rec.Body.String())
		}
	}
	if n := mlbCalls.Load(); n != 2 {
		t.Fatalf("expected 2 MLB fetches (hitting+pitching) for cache miss, got %d", n)
	}
}

func TestTeamSeasonStats_upstreamError(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("group") == "hitting" {
			http.Error(w, "upstream", http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":1,"era":1.0,"whip":1.0,"strikeoutsPer9Inn":1.0,"walksPer9Inn":1.0,"runs":1}}]}]}`))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/121/season-stats?season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d body=%q", rec.Code, rec.Body.String())
	}
}

func TestTeamSeasonStats_pitchingUpstreamError(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("group") == "pitching" {
			http.Error(w, "upstream", http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":1,"runs":1,"ops":0.1,"obp":0.2,"slg":0.3,"avg":0.4}}]}]}`))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/121/season-stats?season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestTeamSeasonStats_invalidPitchingJSON(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("group") == "hitting" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":1,"runs":1,"ops":0.1,"obp":0.2,"slg":0.3,"avg":0.4}}]}]}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`not-json`))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/121/season-stats?season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestTeamSeasonStats_emptyHittingSplits(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/teams/121/stats" {
			http.NotFound(w, r)
			return
		}
		g := r.URL.Query().Get("group")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		switch g {
		case "hitting":
			_, _ = w.Write([]byte(`{"stats":[]}`))
		case "pitching":
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":10,"runs":40,"era":4.0,"whip":1.3,"strikeoutsPer9Inn":8.0,"walksPer9Inn":3.0}}]}]}`))
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
		t.Fatalf("status %d", rec.Code)
	}
	var out models.TeamSeasonStatsResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Hitting.GamesPlayed != 0 || out.Pitching.GamesPlayed != 10 {
		t.Fatalf("hitting=%+v pitching=%+v", out.Hitting, out.Pitching)
	}
}

func TestTeamSeasonStats_invalidMLBJSON(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("group") == "hitting" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`not-json`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":1,"era":1.0,"whip":1.0,"strikeoutsPer9Inn":1.0,"walksPer9Inn":1.0,"runs":1}}]}]}`))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/season-stats", h.TeamSeasonStats)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/121/season-stats?season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestTeamSeasonStats_statNotObject(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/teams/121/stats" {
			http.NotFound(w, r)
			return
		}
		g := r.URL.Query().Get("group")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		switch g {
		case "hitting":
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":42}]}]}`))
		case "pitching":
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":5,"runs":20,"era":3.0,"whip":1.1,"strikeoutsPer9Inn":9.0,"walksPer9Inn":3.0}}]}]}`))
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
		t.Fatalf("status %d", rec.Code)
	}
	var out models.TeamSeasonStatsResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Hitting.GamesPlayed != 0 || out.Pitching.Era == 0 {
		t.Fatalf("hitting=%+v pitching=%+v", out.Hitting, out.Pitching)
	}
}

func TestTeamSeasonStats_stringAndPlaceholderRates(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/teams/121/stats" {
			http.NotFound(w, r)
			return
		}
		g := r.URL.Query().Get("group")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		switch g {
		case "hitting":
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":"15","runs":"45","ops":"0.800","avg":".---"}}]}]}`))
		case "pitching":
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":"15","runs":"40","era":"-.--","whip":"1.20","strikeoutsPer9Inn":"9.0","walksPer9Inn":"3.0"}}]}]}`))
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
	if out.Hitting.GamesPlayed != 15 || out.Hitting.Runs != 45 {
		t.Fatalf("hitting %+v", out.Hitting)
	}
	if out.Hitting.Avg != 0 || out.Pitching.Era != 0 {
		t.Fatalf("placeholders: hitting.avg=%v pitching.era=%v", out.Hitting.Avg, out.Pitching.Era)
	}
}

func TestTeamSeasonStats_zeroGames_skipsPerGameRates(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/teams/121/stats" {
			http.NotFound(w, r)
			return
		}
		g := r.URL.Query().Get("group")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		switch g {
		case "hitting":
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":0,"runs":5,"ops":0.1,"obp":0.2,"slg":0.3,"avg":0.0}}]}]}`))
		case "pitching":
			_, _ = w.Write([]byte(`{"stats":[{"splits":[{"stat":{"gamesPlayed":0,"runs":5,"era":0.0,"whip":0.0,"strikeoutsPer9Inn":0.0,"walksPer9Inn":0.0}}]}]}`))
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
		t.Fatalf("status %d", rec.Code)
	}
	var out models.TeamSeasonStatsResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Hitting.RunsPerGame != 0 || out.Pitching.RunsAllowedPerGame != 0 {
		t.Fatalf("per-game rates should be 0 when GP=0: hitting=%+v pitching=%+v", out.Hitting, out.Pitching)
	}
}
