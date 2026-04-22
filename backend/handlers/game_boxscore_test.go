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

const minimalBoxscoreJSON = `{
  "teams": {
    "away": {
      "team": {"id": 121, "name": "Away"},
      "teamStats": {
        "batting": {"runs": 3, "hits": 8, "leftOnBase": 5, "doubles": 1, "triples": 0, "homeRuns": 1},
        "pitching": {},
        "fielding": {"errors": 0}
      },
      "batters": [1001],
      "pitchers": [2001],
      "players": {
        "ID1001": {
          "person": {"id": 1001, "fullName": "Away Batter"},
          "position": {"abbreviation": "LF"},
          "stats": {"batting": {"atBats": 4, "plateAppearances": 4, "runs": 1, "hits": 2, "doubles": 0, "triples": 0, "homeRuns": 0, "rbi": 1, "baseOnBalls": 0, "strikeOuts": 1}}
        },
        "ID2001": {
          "person": {"id": 2001, "fullName": "Away Pitcher"},
          "position": {"abbreviation": "P"},
          "stats": {"pitching": {"inningsPitched": "7.0", "hits": 4, "runs": 2, "earnedRuns": 2, "baseOnBalls": 1, "strikeOuts": 6, "homeRuns": 0}}
        }
      }
    },
    "home": {
      "team": {"id": 144, "name": "Home"},
      "teamStats": {
        "batting": {"runs": 2, "hits": 6, "leftOnBase": 4, "doubles": 0, "triples": 1, "homeRuns": 0},
        "pitching": {},
        "fielding": {"errors": 1}
      },
      "batters": [1002],
      "pitchers": [2002],
      "players": {
        "ID1002": {
          "person": {"id": 1002, "fullName": "Home Batter"},
          "position": {"abbreviation": "SS"},
          "stats": {"batting": {"atBats": 3, "plateAppearances": 4, "runs": 0, "hits": 1, "doubles": 0, "triples": 0, "homeRuns": 0, "rbi": 0, "baseOnBalls": 1, "strikeOuts": 2}}
        },
        "ID2002": {
          "person": {"id": 2002, "fullName": "Home Pitcher"},
          "position": {"abbreviation": "P"},
          "stats": {"pitching": {"inningsPitched": "7.0", "hits": 5, "runs": 3, "earnedRuns": 3, "baseOnBalls": 2, "strikeOuts": 5, "homeRuns": 1}}
        }
      }
    }
  }
}`

// Pregame / scheduled: no batter or pitcher lines yet; API must emit [] not null for slices.
const pregameBoxscoreJSON = `{
  "teams": {
    "away": {
      "team": {"id": 121, "name": "Away"},
      "teamStats": {
        "batting": {"runs": 0, "hits": 0},
        "pitching": {},
        "fielding": {"errors": 0}
      },
      "batters": [],
      "pitchers": [],
      "players": {}
    },
    "home": {
      "team": {"id": 144, "name": "Home"},
      "teamStats": {
        "batting": {"runs": 0, "hits": 0},
        "pitching": {},
        "fielding": {"errors": 0}
      },
      "batters": [],
      "pitchers": [],
      "players": {}
    }
  }
}`

func TestGameBoxscore_invalidGamePk(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/nope/boxscore", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestGameBoxscore_success(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/game/999/boxscore" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(minimalBoxscoreJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/999/boxscore", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.GameBoxscoreResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.GamePk != 999 {
		t.Fatalf("GamePk: %d", out.GamePk)
	}
	if out.Away.TeamName != "Away" || out.Home.TeamName != "Home" {
		t.Fatalf("teams: %+v %+v", out.Away, out.Home)
	}
	if len(out.Away.Batting) < 1 || len(out.Away.Pitching) < 1 {
		t.Fatalf("lines: batting=%d pitching=%d", len(out.Away.Batting), len(out.Away.Pitching))
	}
}

func TestGameBoxscore_pregameEmitsEmptyArraysNotNull(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/game/1000/boxscore" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(pregameBoxscoreJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/1000/boxscore", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if strings.Contains(body, `"batting":null`) || strings.Contains(body, `"pitching":null`) {
		t.Fatalf("expected non-null JSON arrays for batting/pitching: %s", body)
	}
	var out models.GameBoxscoreResponse
	if err := json.NewDecoder(strings.NewReader(body)).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Away.Batting == nil || out.Home.Batting == nil {
		t.Fatal("decoded Batting should be non-nil empty slice")
	}
	if out.Away.Pitching == nil || out.Home.Pitching == nil {
		t.Fatal("decoded Pitching should be non-nil empty slice")
	}
}

func TestGameBoxscore_upstreamError(t *testing.T) {
	h := newTestHandlers(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "err", http.StatusBadGateway)
	}))
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/1/boxscore", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func Test_flexInt(t *testing.T) {
	tests := []struct {
		name string
		m    map[string]interface{}
		key  string
		want int
	}{
		{"nil map", nil, "runs", 0},
		{"missing key", map[string]interface{}{"hits": 1}, "runs", 0},
		{"nil value", map[string]interface{}{"runs": nil}, "runs", 0},
		{"float64", map[string]interface{}{"runs": 4.0}, "runs", 4},
		{"int", map[string]interface{}{"runs": 5}, "runs", 5},
		{"string int", map[string]interface{}{"runs": "7"}, "runs", 7},
		{"string float trunc", map[string]interface{}{"runs": "2.9"}, "runs", 2},
		{"empty string", map[string]interface{}{"runs": "  "}, "runs", 0},
		{"dash stat", map[string]interface{}{"runs": "-.--"}, "runs", 0},
		{"invalid string", map[string]interface{}{"runs": "nope"}, "runs", 0},
		{"bool default", map[string]interface{}{"runs": true}, "runs", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := flexInt(tt.m, tt.key); got != tt.want {
				t.Fatalf("flexInt(%v, %q) = %d want %d", tt.m, tt.key, got, tt.want)
			}
		})
	}
}

func Test_flexString(t *testing.T) {
	tests := []struct {
		name string
		m    map[string]interface{}
		key  string
		want string
	}{
		{"nil map", nil, "inningsPitched", ""},
		{"missing", map[string]interface{}{}, "inningsPitched", ""},
		{"nil value", map[string]interface{}{"inningsPitched": nil}, "inningsPitched", ""},
		{"string", map[string]interface{}{"inningsPitched": "6.1"}, "inningsPitched", "6.1"},
		{"float64", map[string]interface{}{"inningsPitched": 7.2}, "inningsPitched", "7.2"},
		{"int", map[string]interface{}{"inningsPitched": 9}, "inningsPitched", "9"},
		{"bool default", map[string]interface{}{"inningsPitched": false}, "inningsPitched", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := flexString(tt.m, tt.key); got != tt.want {
				t.Fatalf("flexString(%v, %q) = %q want %q", tt.m, tt.key, got, tt.want)
			}
		})
	}
}

func Test_hasPitchingLine(t *testing.T) {
	tests := []struct {
		name string
		pit  map[string]interface{}
		want bool
	}{
		{"innings 1.0", map[string]interface{}{"inningsPitched": "1.0"}, true},
		{"innings with spaces", map[string]interface{}{"inningsPitched": "  0.1 "}, true},
		{"ip 0.0 only", map[string]interface{}{"inningsPitched": "0.0", "battersFaced": 0, "outs": 0}, false},
		{"ip 0 only", map[string]interface{}{"inningsPitched": "0"}, false},
		{"empty ip battersFaced", map[string]interface{}{"inningsPitched": "", "battersFaced": 1}, true},
		{"empty ip outs", map[string]interface{}{"inningsPitched": "0.0", "outs": 1}, true},
		{"float ip nonzero", map[string]interface{}{"inningsPitched": 6.1}, true},
		{"nothing", map[string]interface{}{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := hasPitchingLine(tt.pit); got != tt.want {
				t.Fatalf("hasPitchingLine(%v) = %v want %v", tt.pit, got, tt.want)
			}
		})
	}
}

// edgeCaseBoxscoreJSON exercises stringified team totals, empty batter position (→ "—"),
// pitcher with no IP string but battersFaced, and inningsPitched as JSON number.
const edgeCaseBoxscoreJSON = `{
  "teams": {
    "away": {
      "team": {"id": 121, "name": "Away"},
      "teamStats": {
        "batting": {"runs": "4", "hits": "9", "leftOnBase": 3, "doubles": 1, "triples": 0, "homeRuns": 1},
        "pitching": {},
        "fielding": {"errors": "2"}
      },
      "batters": [5001],
      "pitchers": [6001, 6002],
      "players": {
        "ID5001": {
          "person": {"id": 5001, "fullName": "Pinch"},
          "position": {"abbreviation": ""},
          "stats": {"batting": {"atBats": 1, "plateAppearances": 1, "runs": 0, "hits": 0, "doubles": 0, "triples": 0, "homeRuns": 0, "rbi": 0, "baseOnBalls": 0, "strikeOuts": 0}}
        },
        "ID6001": {
          "person": {"id": 6001, "fullName": "Hidden IP"},
          "position": {"abbreviation": "P"},
          "stats": {"pitching": {"inningsPitched": "0", "battersFaced": 4, "hits": 1, "runs": 0, "earnedRuns": 0, "baseOnBalls": 0, "strikeOuts": 1, "homeRuns": 0}}
        },
        "ID6002": {
          "person": {"id": 6002, "fullName": "Numeric IP"},
          "position": {"abbreviation": "P"},
          "stats": {"pitching": {"inningsPitched": 5.1, "hits": 2, "runs": 1, "earnedRuns": 1, "baseOnBalls": 0, "strikeOuts": 7, "homeRuns": 0}}
        }
      }
    },
    "home": {
      "team": {"id": 144, "name": "Home"},
      "teamStats": {
        "batting": {"runs": 1, "hits": 4, "leftOnBase": 2, "doubles": 0, "triples": 0, "homeRuns": 0},
        "pitching": {},
        "fielding": {"errors": 0}
      },
      "batters": [],
      "pitchers": [],
      "players": {}
    }
  }
}`

func TestGameBoxscore_edgeCaseParsing(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/game/777/boxscore" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(edgeCaseBoxscoreJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/boxscore", h.GameBoxscore)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/777/boxscore", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}

	var out models.GameBoxscoreResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Away.Totals.Runs != 4 || out.Away.Totals.Hits != 9 || out.Away.Totals.Errors != 2 {
		t.Fatalf("away totals: %+v", out.Away.Totals)
	}
	if len(out.Away.Batting) != 1 {
		t.Fatalf("batting rows: %d", len(out.Away.Batting))
	}
	if out.Away.Batting[0].Pos != "—" {
		t.Fatalf("empty position: got %q want em dash", out.Away.Batting[0].Pos)
	}
	if len(out.Away.Pitching) != 2 {
		t.Fatalf("pitching rows: %d", len(out.Away.Pitching))
	}
	// Pitcher 6001: no traditional IP but battersFaced > 0
	if out.Away.Pitching[0].IP != "0" {
		t.Fatalf("pitcher 1 IP: got %q", out.Away.Pitching[0].IP)
	}
	// Pitcher 6002: JSON number inningsPitched → flexString
	if out.Away.Pitching[1].IP != "5.1" {
		t.Fatalf("pitcher 2 IP: got %q want 5.1", out.Away.Pitching[1].IP)
	}
}
