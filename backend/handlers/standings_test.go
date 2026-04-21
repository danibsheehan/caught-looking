package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"caught-looking/backend/models"
)

const standingsJSON = `{
  "records": [
    {
      "division": {"id": 201, "name": "East"},
      "league": {"id": 103},
      "teamRecords": [
        {
          "team": {"id": 121, "name": "Mets"},
          "gamesPlayed": 10,
          "divisionRank": "1",
          "wildCardGamesBack": "-",
          "gamesBack": "-",
          "runsScored": 55,
          "runsAllowed": 44,
          "runDifferential": 11,
          "streak": {"streakCode": "W2"},
          "records": {
            "splitRecords": [
              {"type": "home", "wins": 5, "losses": 1},
              {"type": "away", "wins": 4, "losses": 4},
              {"type": "lastTen", "wins": 6, "losses": 4}
            ]
          },
          "leagueRecord": {"wins": 9, "losses": 5, "pct": ".643"}
        }
      ]
    }
  ]
}`

const divisionsJSON = `{"divisions":[{"id":201,"name":"NL East"}]}`

func TestStandings_invalidSeason(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/standings?season=1700", nil)
	h.Standings(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestStandings_invalidLeagueID(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/standings?leagueId=abc", nil)
	h.Standings(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestStandings_success(t *testing.T) {
	var sawStandings, sawDivisions bool
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/standings":
			sawStandings = true
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(standingsJSON))
		case "/divisions":
			sawDivisions = true
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(divisionsJSON))
		default:
			http.NotFound(w, r)
		}
	})
	h := newTestHandlers(t, mlb)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/standings?season=2026&leagueId=103", nil)
	h.Standings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if !sawStandings || !sawDivisions {
		t.Fatalf("expected standings + divisions requests: standings=%v divisions=%v", sawStandings, sawDivisions)
	}
	var out models.StandingsResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Season != 2026 || len(out.Divisions) != 1 {
		t.Fatalf("response: %+v", out)
	}
	if len(out.Divisions[0].Teams) != 1 || out.Divisions[0].Teams[0].TeamName != "Mets" {
		t.Fatalf("division: %+v", out.Divisions[0])
	}
}

func TestStandings_upstreamParseError(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/standings" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`not json`))
			return
		}
		if r.URL.Path == "/divisions" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(divisionsJSON))
			return
		}
		http.NotFound(w, r)
	})
	h := newTestHandlers(t, mlb)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/standings", nil)
	h.Standings(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}
