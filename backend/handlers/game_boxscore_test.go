package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
