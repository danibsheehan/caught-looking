package handlers

import (
	"encoding/json"
	"math"
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

func TestLeagueSeasonBaseline_nonMLBLeaguesFilteredToZero(t *testing.T) {
	// loadLeagueTeamStatMaps keeps only league 103/104; everything else is dropped.
	const onlyNonMLB = `{"stats":[{"splits":[
		{"league":{"id":200},"team":{"id":1},"stat":{"gamesPlayed":5,"hits":1,"atBats":1,"totalBases":1,"baseOnBalls":0,"hitByPitch":0,"sacFlies":0}}
	]}]}`
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/stats" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(onlyNonMLB))
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
	if out.Ops != 0 {
		t.Fatalf("expected 0 OPS when no AL/NL rows, got %v", out.Ops)
	}
}

func TestLeagueSeasonBaseline_emptySplitsZeroRate(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/stats" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"stats":[{"splits":[]}]}`))
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
	if out.Ops != 0 {
		t.Fatalf("empty splits: want Ops 0, got %v", out.Ops)
	}
}

func Test_leagueRateFromTeamMaps(t *testing.T) {
	const eps = 1e-6

	t.Run("empty map", func(t *testing.T) {
		empty := map[int]map[string]interface{}{}
		if g := leagueRateFromTeamMaps(empty, "hitting", "ops"); g != 0 {
			t.Fatalf("hitting ops: got %v", g)
		}
		if g := leagueRateFromTeamMaps(empty, "pitching", "era"); g != 0 {
			t.Fatalf("pitching era: got %v", g)
		}
	})

	t.Run("hitting zero at bats", func(t *testing.T) {
		best := map[int]map[string]interface{}{
			1: {"hits": 0, "atBats": 0, "totalBases": 0, "baseOnBalls": 0, "hitByPitch": 0, "sacFlies": 0},
		}
		if g := leagueRateFromTeamMaps(best, "hitting", "ops"); g != 0 {
			t.Fatalf("got %v", g)
		}
	})

	t.Run("hitting ops avg obp slg", func(t *testing.T) {
		// One synthetic league row: OBP = (h+bb+hbp)/(ab+bb+hbp+sf), SLG = tb/ab
		best := map[int]map[string]interface{}{
			99: {
				"hits": 10, "atBats": 40, "totalBases": 20, "baseOnBalls": 5,
				"hitByPitch": 1, "sacFlies": 2,
			},
		}
		den := 40.0 + 5.0 + 1.0 + 2.0
		wantOBP := (10.0 + 5.0 + 1.0) / den
		wantSLG := 20.0 / 40.0
		wantOPS := wantOBP + wantSLG
		if g := leagueRateFromTeamMaps(best, "hitting", "ops"); math.Abs(g-wantOPS) > eps {
			t.Fatalf("ops got %v want %v", g, wantOPS)
		}
		if g := leagueRateFromTeamMaps(best, "hitting", "avg"); math.Abs(g-0.25) > eps {
			t.Fatalf("avg got %v", g)
		}
		if g := leagueRateFromTeamMaps(best, "hitting", "obp"); math.Abs(g-wantOBP) > eps {
			t.Fatalf("obp got %v", g)
		}
		if g := leagueRateFromTeamMaps(best, "hitting", "slg"); math.Abs(g-wantSLG) > eps {
			t.Fatalf("slg got %v", g)
		}
	})

	t.Run("hitting aggregates two teams", func(t *testing.T) {
		best := map[int]map[string]interface{}{
			1: {"hits": 90, "atBats": 300, "totalBases": 150, "baseOnBalls": 40, "hitByPitch": 5, "sacFlies": 5},
			2: {"hits": 80, "atBats": 280, "totalBases": 140, "baseOnBalls": 35, "hitByPitch": 4, "sacFlies": 4},
		}
		got := leagueRateFromTeamMaps(best, "hitting", "ops")
		want := leagueRateFromTeamMaps(map[int]map[string]interface{}{
			99: {"hits": 170, "atBats": 580, "totalBases": 290, "baseOnBalls": 75, "hitByPitch": 9, "sacFlies": 9},
		}, "hitting", "ops")
		if math.Abs(got-want) > eps {
			t.Fatalf("two-team aggregate ops got %v want %v", got, want)
		}
	})

	t.Run("hitting woba weighted by PA", func(t *testing.T) {
		best := map[int]map[string]interface{}{
			1: {"weightedOnBaseAverage": 0.36, "plateAppearances": 100, "hits": 1, "atBats": 1, "totalBases": 1, "baseOnBalls": 0, "hitByPitch": 0, "sacFlies": 0},
			2: {"woba": 0.34, "plateAppearances": 50, "hits": 1, "atBats": 1, "totalBases": 1, "baseOnBalls": 0, "hitByPitch": 0, "sacFlies": 0},
		}
		want := (0.36*100 + 0.34*50) / 150.0
		if g := leagueRateFromTeamMaps(best, "hitting", "woba"); math.Abs(g-want) > eps {
			t.Fatalf("woba got %v want %v", g, want)
		}
	})

	t.Run("hitting woba no qualifying rows", func(t *testing.T) {
		best := map[int]map[string]interface{}{
			1: {"woba": 0.35, "plateAppearances": 0, "hits": 1, "atBats": 1, "totalBases": 1, "baseOnBalls": 0, "hitByPitch": 0, "sacFlies": 0},
		}
		if g := leagueRateFromTeamMaps(best, "hitting", "woba"); g != 0 {
			t.Fatalf("got %v want 0", g)
		}
	})

	t.Run("hitting unknown metric", func(t *testing.T) {
		best := map[int]map[string]interface{}{
			1: {"hits": 10, "atBats": 40, "totalBases": 20, "baseOnBalls": 0, "hitByPitch": 0, "sacFlies": 0},
		}
		if g := leagueRateFromTeamMaps(best, "hitting", "iso"); g != 0 {
			t.Fatalf("got %v", g)
		}
	})

	t.Run("pitching era whip k9 bb9", func(t *testing.T) {
		best := map[int]map[string]interface{}{
			1: {"earnedRuns": 4, "inningsPitched": "4.0", "hits": 10, "baseOnBalls": 3, "strikeOuts": 8, "homeRuns": 1},
		}
		if g := leagueRateFromTeamMaps(best, "pitching", "era"); math.Abs(g-9.0) > eps {
			t.Fatalf("era got %v want 9", g)
		}
		if g := leagueRateFromTeamMaps(best, "pitching", "whip"); math.Abs(g-13.0/4.0) > eps {
			t.Fatalf("whip got %v", g)
		}
		if g := leagueRateFromTeamMaps(best, "pitching", "k9"); math.Abs(g-9.0*8.0/4.0) > eps {
			t.Fatalf("k9 got %v", g)
		}
		if g := leagueRateFromTeamMaps(best, "pitching", "bb9"); math.Abs(g-9.0*3.0/4.0) > eps {
			t.Fatalf("bb9 got %v", g)
		}
	})

	t.Run("pitching zero innings", func(t *testing.T) {
		best := map[int]map[string]interface{}{
			1: {"earnedRuns": 1, "inningsPitched": "0.0"},
		}
		if g := leagueRateFromTeamMaps(best, "pitching", "era"); g != 0 {
			t.Fatalf("got %v", g)
		}
	})

	t.Run("pitching fip weighted by innings", func(t *testing.T) {
		best := map[int]map[string]interface{}{
			1: {"fip": 4.0, "inningsPitched": "9.0", "earnedRuns": 0, "hits": 0, "baseOnBalls": 0, "strikeOuts": 0, "homeRuns": 0},
			2: {"fip": 2.0, "inningsPitched": "9.0", "earnedRuns": 0, "hits": 0, "baseOnBalls": 0, "strikeOuts": 0, "homeRuns": 0},
		}
		want := (4.0*9.0 + 2.0*9.0) / 18.0
		if g := leagueRateFromTeamMaps(best, "pitching", "fip"); math.Abs(g-want) > eps {
			t.Fatalf("fip got %v want %v", g, want)
		}
	})

	t.Run("pitching fip fallback counting formula", func(t *testing.T) {
		best := map[int]map[string]interface{}{
			1: {
				"inningsPitched": "9.0",
				"earnedRuns":     1,
				"hits":           0,
				"baseOnBalls":    2,
				"strikeOuts":     10,
				"homeRuns":       1,
				"hitByPitch":     1,
			},
		}
		// No per-row fip>0 → fallback: (13*hr + 3*(bb+hbp) - 2*so) / ip
		want := (13.0*1.0 + 3.0*(2.0+1.0) - 2.0*10.0) / 9.0
		if g := leagueRateFromTeamMaps(best, "pitching", "fip"); math.Abs(g-want) > eps {
			t.Fatalf("fip fallback got %v want %v", g, want)
		}
	})

	t.Run("pitching unknown metric", func(t *testing.T) {
		best := map[int]map[string]interface{}{
			1: {"earnedRuns": 1, "inningsPitched": "9.0"},
		}
		if g := leagueRateFromTeamMaps(best, "pitching", "xFIP"); g != 0 {
			t.Fatalf("got %v", g)
		}
	})
}
