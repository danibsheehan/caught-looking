package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

func TestPlayersCompareYearByYear_validation(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/players/compare/year-by-year", h.PlayersCompareYearByYear)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/compare/year-by-year?ids=1", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestPlayersCompareYearByYear_success(t *testing.T) {
	const baselineJSON = `{"stats":[{"splits":[{"league":{"id":103},"team":{"id":121},"stat":{"gamesPlayed":10,"hits":90,"atBats":300,"totalBases":150,"baseOnBalls":40,"hitByPitch":5,"sacFlies":5}}]}]}`
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/stats":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(baselineJSON))
			return
		default:
			if !strings.HasPrefix(r.URL.Path, "/people/") || !strings.HasSuffix(r.URL.Path, "/stats") {
				http.NotFound(w, r)
				return
			}
			if r.URL.Query().Get("stats") != "yearByYear" || r.URL.Query().Get("group") != "hitting" {
				http.Error(w, "bad query", http.StatusBadRequest)
				return
			}
			parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
			id := parts[1]
			body := `{"stats":[{"splits":[{"season":"2026","player":{"id":` + id + `,"fullName":"Y` + id + `"},"stat":{"ops":0.8}}]}]}`
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(body))
		}
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/compare/year-by-year", h.PlayersCompareYearByYear)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/compare/year-by-year?ids=3,4&group=hitting", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.PlayersYearByYearResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Group != "hitting" || out.Metric != "ops" {
		t.Fatalf("meta: %+v", out)
	}
	if len(out.Players) != 2 || len(out.LeagueBySeason) < 1 {
		t.Fatalf("response: %+v", out)
	}
}

func TestPlayersCompareGameLog_validation(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/players/compare/game-log", h.PlayersCompareGameLog)

	tests := []struct {
		path string
	}{
		{"/players/compare/game-log?ids=1"},
		{"/players/compare/game-log?ids=1,2&season=1700"},
		{"/players/compare/game-log?ids=1,2&limit=3"},
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

func TestPlayersCompareGameLog_success(t *testing.T) {
	const baselineJSON = `{"stats":[{"splits":[{"league":{"id":103},"team":{"id":121},"stat":{"gamesPlayed":10,"hits":90,"atBats":300,"totalBases":150,"baseOnBalls":40,"hitByPitch":5,"sacFlies":5}}]}]}`
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/stats":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(baselineJSON))
			return
		default:
			if !strings.HasPrefix(r.URL.Path, "/people/") || !strings.HasSuffix(r.URL.Path, "/stats") {
				http.NotFound(w, r)
				return
			}
			q := r.URL.Query()
			if q.Get("stats") != "gameLog" || q.Get("group") != "hitting" || q.Get("season") != "2026" {
				http.Error(w, "bad query", http.StatusBadRequest)
				return
			}
			parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
			id := parts[1]
			body := `{"stats":[{"splits":[
				{"date":"2026-04-01","game":{"gamePk":1},"player":{"id":` + id + `,"fullName":"G` + id + `"},"stat":{"ops":0.71}},
				{"date":"2026-04-03","game":{"gamePk":2},"player":{"id":` + id + `,"fullName":"G` + id + `"},"stat":{"ops":0.82}}
			]}]}`
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(body))
		}
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/compare/game-log", h.PlayersCompareGameLog)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/compare/game-log?ids=5,6&group=hitting&season=2026&limit=10", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.PlayersGameLogResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Season != 2026 || out.Group != "hitting" || out.Limit != 10 {
		t.Fatalf("meta: %+v", out)
	}
	if len(out.Players) != 2 {
		t.Fatalf("players: %d", len(out.Players))
	}
}
