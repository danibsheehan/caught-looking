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

	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/players/compare/year-by-year?ids=1,2&group=hitting&metric=era", nil)
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("invalid metric: status: got %d", rec2.Code)
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

func TestPlayersCompareYearByYear_reusesLeagueTeamStatsCache(t *testing.T) {
	var statsHits atomic.Int32
	const baselineJSON = `{"stats":[{"splits":[{"league":{"id":103},"team":{"id":121},"stat":{"gamesPlayed":10,"hits":90,"atBats":300,"totalBases":150,"baseOnBalls":40,"hitByPitch":5,"sacFlies":5,"avg":".300","obp":".370","slg":".500","ops":".870"}}]}]}`
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/stats":
			statsHits.Add(1)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(baselineJSON))
			return
		default:
			if !strings.HasPrefix(r.URL.Path, "/people/") || !strings.HasSuffix(r.URL.Path, "/stats") {
				http.NotFound(w, r)
				return
			}
			parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
			id := parts[1]
			body := `{"stats":[{"splits":[
				{"season":"2024","player":{"id":` + id + `,"fullName":"Y` + id + `"},"stat":{"ops":0.8,"avg":0.3,"obp":0.37,"slg":0.5}},
				{"season":"2025","player":{"id":` + id + `,"fullName":"Y` + id + `"},"stat":{"ops":0.81,"avg":0.31,"obp":0.38,"slg":0.51}}
			]}]}`
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(body))
		}
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/compare/year-by-year", h.PlayersCompareYearByYear)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/compare/year-by-year?ids=3,4&group=hitting&metric=ops", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("ops: status %d: %s", rec.Code, rec.Body.String())
	}
	if got := statsHits.Load(); got != 2 {
		t.Fatalf("after ops: /stats hits got %d want 2 (one per season)", got)
	}

	// Different metric, same seasons — must reuse league-team-stats cache (no extra /stats).
	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/players/compare/year-by-year?ids=3,4&group=hitting&metric=avg", nil)
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("avg: status %d: %s", rec2.Code, rec2.Body.String())
	}
	if got := statsHits.Load(); got != 2 {
		t.Fatalf("after avg: /stats hits got %d want 2 (cached)", got)
	}
}

func TestPlayersCompareYearByYear_upstreamError(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/compare/year-by-year", h.PlayersCompareYearByYear)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/compare/year-by-year?ids=3,4&group=hitting", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func Test_validYearByYearMetric(t *testing.T) {
	tests := []struct {
		name   string
		group  string
		metric string
		want   bool
	}{
		{"hitting ops", "hitting", "ops", true},
		{"hitting avg", "hitting", "avg", true},
		{"hitting obp", "hitting", "obp", true},
		{"hitting slg", "hitting", "slg", true},
		{"hitting woba", "hitting", "woba", true},
		{"pitching era", "pitching", "era", true},
		{"pitching whip", "pitching", "whip", true},
		{"pitching k9", "pitching", "k9", true},
		{"pitching bb9", "pitching", "bb9", true},
		{"pitching fip", "pitching", "fip", true},
		{"pitching metric under hitting", "hitting", "era", false},
		{"hitting metric under pitching", "pitching", "ops", false},
		{"unknown group", "fielding", "ops", false},
		{"empty group and metric", "", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := validYearByYearMetric(tt.group, tt.metric); got != tt.want {
				t.Fatalf("validYearByYearMetric(%q, %q) = %v want %v", tt.group, tt.metric, got, tt.want)
			}
		})
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
