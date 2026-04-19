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

func TestPlayersCompare_validation(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/players/compare", h.PlayersCompare)

	tests := []struct {
		name       string
		path       string
		wantStatus int
	}{
		{"missing ids", "/players/compare", http.StatusBadRequest},
		{"wrong id count", "/players/compare?ids=1", http.StatusBadRequest},
		{"invalid ids", "/players/compare?ids=x,y", http.StatusBadRequest},
		{"bad group", "/players/compare?ids=1,2&group=basketball", http.StatusBadRequest},
		{"bad scope", "/players/compare?ids=1,2&scope=lifetime", http.StatusBadRequest},
		{"bad season", "/players/compare?ids=1,2&scope=season&season=1800", http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			r.ServeHTTP(rec, req)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status: got %d want %d body=%q", rec.Code, tt.wantStatus, rec.Body.String())
			}
		})
	}
}

func TestPlayersCompare_success_season_hitting(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method", http.StatusMethodNotAllowed)
			return
		}
		if !strings.HasPrefix(r.URL.Path, "/people/") || !strings.HasSuffix(r.URL.Path, "/stats") {
			http.NotFound(w, r)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) != 3 || parts[0] != "people" || parts[2] != "stats" {
			http.NotFound(w, r)
			return
		}
		id := parts[1]
		q := r.URL.Query()
		if q.Get("stats") != "season" || q.Get("group") != "hitting" {
			http.Error(w, "bad query", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		body := `{"stats":[{"splits":[{"season":"2026","player":{"id":` + id + `,"fullName":"Player ` + id + `"},"stat":{"avg":".300","ops":0.85,"homeRuns":12,"rbi":40,"runs":50,"hits":100,"doubles":20,"triples":2,"baseOnBalls":30,"strikeOuts":80,"stolenBases":5,"plateAppearances":500,"gamesPlayed":100,"weightedOnBaseAverage":0.36}}]}]}`
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/compare", h.PlayersCompare)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/compare?ids=1,2&group=hitting&scope=season&season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.PlayersRadarResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Scope != "season" || out.Season != 2026 || out.Group != "hitting" {
		t.Fatalf("meta: %+v", out)
	}
	if len(out.Players) != 2 {
		t.Fatalf("players: %d", len(out.Players))
	}
	if out.Players[0].FullName != "Player 1" || out.Players[1].FullName != "Player 2" {
		t.Fatalf("names: %+v", out.Players)
	}
}

func TestPlayersCompare_upstreamError(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/compare", h.PlayersCompare)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/compare?ids=10,20&group=hitting&scope=season", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestParseBaseballInnings(t *testing.T) {
	tests := []struct {
		in   string
		want float64
	}{
		{"", 0},
		{"9", 9},
		{"6.0", 6},
		{"6.1", 6 + 1.0/3.0},
		{"6.2", 6 + 2.0/3.0},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			got := parseBaseballInnings(tt.in)
			if got != tt.want {
				t.Fatalf("parseBaseballInnings(%q) = %v want %v", tt.in, got, tt.want)
			}
		})
	}
}
