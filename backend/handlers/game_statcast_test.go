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

const minimalStatcastCSV = `launch_speed,launch_angle,batter,pitcher,player_name,events,inning_topbot,hc_x,hc_y
95.1,12.2,12345,67890,Test Batter,single,Top,130.0,45.0
88.0,-5.0,12345,67891,Test Batter 2,grounded_into_double_play,Bot,118.0,12.0
`

func TestGameStatcast_invalidGamePk(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/statcast", h.GameStatcast)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/nope/statcast", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestGameStatcast_success(t *testing.T) {
	up := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/statcast_search/csv" && strings.Contains(r.URL.RawQuery, "game_pk=888"):
			w.Header().Set("Content-Type", "text/csv")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(minimalStatcastCSV))
		case r.URL.Path == "/schedule" && r.URL.Query().Get("gamePks") == "888" && r.URL.Query().Get("sportId") == "1":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"dates":[{"games":[{"venue":{"id":3309,"name":"Nationals Park"}}]}]}`))
		default:
			http.NotFound(w, r)
		}
	})
	h := newTestHandlers(t, up)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/statcast", h.GameStatcast)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/888/statcast", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.GameStatcastResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.GamePk != 888 {
		t.Fatalf("GamePk: %d", out.GamePk)
	}
	if len(out.BattedBalls) != 2 {
		t.Fatalf("batted balls: %d", len(out.BattedBalls))
	}
	if out.BattedBalls[0].PlayerName != "Test Batter" || out.BattedBalls[0].InningHalf != "Top" {
		t.Fatalf("row0: %+v", out.BattedBalls[0])
	}
	if out.BattedBalls[1].InningHalf != "Bottom" {
		t.Fatalf("Savant Bot should normalize to Bottom: %+v", out.BattedBalls[1])
	}
	if out.BattedBalls[0].LaunchSpeed == nil || *out.BattedBalls[0].LaunchSpeed != 95.1 {
		t.Fatalf("launch speed: %+v", out.BattedBalls[0].LaunchSpeed)
	}
	if out.BattedBalls[0].HCX == nil || *out.BattedBalls[0].HCX != 130.0 {
		t.Fatalf("hcX: %+v", out.BattedBalls[0].HCX)
	}
	if out.BattedBalls[0].HCY == nil || *out.BattedBalls[0].HCY != 45.0 {
		t.Fatalf("hcY: %+v", out.BattedBalls[0].HCY)
	}
	if out.VenueID != 3309 || out.VenueName != "Nationals Park" {
		t.Fatalf("venue: id=%d name=%q", out.VenueID, out.VenueName)
	}
}

func TestGameStatcast_upstreamError(t *testing.T) {
	h := newTestHandlers(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "err", http.StatusBadGateway)
	}))
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/statcast", h.GameStatcast)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/1/statcast", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestParseStatcastBattedBallsCSV_emptyBody(t *testing.T) {
	got := parseStatcastBattedBallsCSV(nil)
	if got == nil || len(got) != 0 {
		t.Fatalf("got %v", got)
	}
}
