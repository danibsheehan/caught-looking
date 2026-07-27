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

const scheduleOneFinalGame = `{
  "dates": [
    {
      "games": [
        {
          "officialDate": "2026-04-10",
          "gameDate": "2026-04-10T18:05:00Z",
          "status": {"abstractGameState": "Final"},
          "isTie": false,
          "teams": {
            "away": {"team": {"id": 121}, "isWinner": true},
            "home": {"team": {"id": 144}, "isWinner": false}
          }
        }
      ]
    }
  ]
}`

func TestRecordTimeline_invalidTeamID(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/record-timeline", h.RecordTimeline)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/abc/record-timeline", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestRecordTimeline_success(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/schedule" {
			http.NotFound(w, r)
			return
		}
		q := r.URL.Query()
		if q.Get("teamId") != "121" || q.Get("season") != "2026" {
			http.Error(w, "bad query", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(scheduleOneFinalGame))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/teams/{teamID}/record-timeline", h.RecordTimeline)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams/121/record-timeline?season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.RecordTimelineResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.TeamID != 121 || out.Season != 2026 {
		t.Fatalf("meta: %+v", out)
	}
	if len(out.Points) != 1 || out.Points[0].Result != "W" {
		t.Fatalf("points: %+v", out.Points)
	}
}

func TestParseRecordTimeline_skipsNonFinal(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[{"officialDate":"2026-04-01","gameDate":"2026-04-01T00:00:00Z","status":{"abstractGameState":"Live"},"teams":{"away":{"team":{"id":121},"isWinner":false},"home":{"team":{"id":144},"isWinner":false}}}]}]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 0 || out.Finished != 0 {
		t.Fatalf("got %+v", out)
	}
}

func Test_parseRecordTimeline_invalidJSON(t *testing.T) {
	_, err := parseRecordTimeline([]byte(`{"dates":`), 121, 2026)
	if err == nil {
		t.Fatal("expected error")
	}
}

func Test_parseRecordTimeline_emptyDates(t *testing.T) {
	out, err := parseRecordTimeline([]byte(`{"dates":[]}`), 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 0 || out.TeamID != 121 || out.Season != 2026 {
		t.Fatalf("got %+v", out)
	}
}

func Test_parseRecordTimeline_officialDateFromGameDate(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[{
		"officialDate": "",
		"gameDate": "2026-04-11T23:05:00Z",
		"status": {"abstractGameState": "Final"},
		"isTie": false,
		"teams": {
			"away": {"team": {"id": 121}, "isWinner": true},
			"home": {"team": {"id": 144}, "isWinner": false}
		}
	}]}]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 1 {
		t.Fatalf("points: %d", len(out.Points))
	}
	if out.Points[0].OfficialDate != "2026-04-11" {
		t.Fatalf("OfficialDate: got %q", out.Points[0].OfficialDate)
	}
}

func Test_parseRecordTimeline_sameDaySortsByGameDate(t *testing.T) {
	raw := []byte(`{"dates":[
		{"games":[{
			"officialDate": "2026-04-12",
			"gameDate": "2026-04-12T20:00:00Z",
			"status": {"abstractGameState": "Final"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 121}, "isWinner": true}, "home": {"team": {"id": 144}, "isWinner": false}}
		}]},
		{"games":[{
			"officialDate": "2026-04-12",
			"gameDate": "2026-04-12T16:00:00Z",
			"status": {"abstractGameState": "Final"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 144}, "isWinner": false}, "home": {"team": {"id": 121}, "isWinner": true}}
		}]}
	]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 2 {
		t.Fatalf("want 2 points, got %d", len(out.Points))
	}
	// Same calendar day: earlier gameDate (afternoon) is ordered first → two wins for 121.
	if out.Points[0].OfficialDate != "2026-04-12" || out.Points[0].Result != "W" {
		t.Fatalf("first point: %+v", out.Points[0])
	}
	if out.Points[0].Wins != 1 || out.Points[0].Losses != 0 {
		t.Fatalf("first cumulative: w=%d l=%d", out.Points[0].Wins, out.Points[0].Losses)
	}
	if out.Points[1].Wins != 2 || out.Points[1].Losses != 0 {
		t.Fatalf("second cumulative: w=%d l=%d", out.Points[1].Wins, out.Points[1].Losses)
	}
	if math.Abs(out.Points[1].Pct-1.0) > 1e-9 {
		t.Fatalf("pct: %v", out.Points[1].Pct)
	}
}

func Test_parseRecordTimeline_skipsGamesWithoutTeam(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[
		{
			"officialDate": "2026-04-01",
			"gameDate": "2026-04-01T18:00:00Z",
			"status": {"abstractGameState": "Final"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 110}, "isWinner": true}, "home": {"team": {"id": 120}, "isWinner": false}}
		},
		{
			"officialDate": "2026-04-02",
			"gameDate": "2026-04-02T18:00:00Z",
			"status": {"abstractGameState": "Final"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 121}, "isWinner": false}, "home": {"team": {"id": 144}, "isWinner": true}}
		}
	]}]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 1 || out.Points[0].Result != "L" {
		t.Fatalf("got %+v", out.Points)
	}
}

func Test_parseRecordTimeline_tie(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[{
		"officialDate": "2026-04-03",
		"gameDate": "2026-04-03T18:00:00Z",
		"status": {"abstractGameState": "Final"},
		"isTie": true,
		"teams": {
			"away": {"team": {"id": 121}, "isWinner": false},
			"home": {"team": {"id": 144}, "isWinner": false}
		}
	}]}]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 1 || out.Points[0].Result != "T" {
		t.Fatalf("got %+v", out.Points)
	}
	if out.Points[0].Wins != 0 || out.Points[0].Losses != 0 || out.Points[0].Pct != 0 {
		t.Fatalf("tie should not move W/L: %+v", out.Points[0])
	}
}

func Test_parseRecordTimeline_homeTeamWin(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[{
		"officialDate": "2026-04-04",
		"gameDate": "2026-04-04T18:00:00Z",
		"status": {"abstractGameState": "Final"},
		"isTie": false,
		"teams": {
			"away": {"team": {"id": 144}, "isWinner": false},
			"home": {"team": {"id": 121}, "isWinner": true}
		}
	}]}]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 1 || out.Points[0].Result != "W" || out.Points[0].Wins != 1 {
		t.Fatalf("got %+v", out.Points)
	}
}

func Test_parseRecordTimeline_mixedFinalAndLive(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[
		{
			"officialDate": "2026-04-05",
			"gameDate": "2026-04-05T18:00:00Z",
			"status": {"abstractGameState": "Final"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 121}, "isWinner": true}, "home": {"team": {"id": 144}, "isWinner": false}}
		},
		{
			"officialDate": "2026-04-06",
			"gameDate": "2026-04-06T18:00:00Z",
			"status": {"abstractGameState": "Live"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 121}, "isWinner": false}, "home": {"team": {"id": 144}, "isWinner": false}}
		}
	]}]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 1 {
		t.Fatalf("want 1 final only, got %d", len(out.Points))
	}
}

func Test_parseRecordTimeline_skipsPostponedFinal(t *testing.T) {
	// MLB often marks postponed games abstractGameState=Final with no winners — must not count as L.
	raw := []byte(`{"dates":[{"games":[
		{
			"officialDate": "2026-04-05",
			"gameDate": "2026-04-05T18:00:00Z",
			"status": {"abstractGameState": "Final", "detailedState": "Final"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 121}, "isWinner": true}, "home": {"team": {"id": 144}, "isWinner": false}}
		},
		{
			"officialDate": "2026-08-20",
			"gameDate": "2026-08-20T18:00:00Z",
			"status": {"abstractGameState": "Final", "detailedState": "Postponed"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 121}, "isWinner": false}, "home": {"team": {"id": 144}, "isWinner": false}}
		},
		{
			"officialDate": "2026-08-31",
			"gameDate": "2026-08-31T18:00:00Z",
			"status": {"abstractGameState": "Final", "detailedState": "Postponed"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 144}, "isWinner": false}, "home": {"team": {"id": 121}, "isWinner": false}}
		}
	]}]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 1 || out.Points[0].OfficialDate != "2026-04-05" || out.Points[0].Result != "W" {
		t.Fatalf("want only the real final, got %+v", out.Points)
	}
}

func Test_parseRecordTimeline_skipsFinalWithoutWinner(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[{
		"officialDate": "2026-08-20",
		"gameDate": "2026-08-20T18:00:00Z",
		"status": {"abstractGameState": "Final", "detailedState": "Final"},
		"isTie": false,
		"teams": {
			"away": {"team": {"id": 121}, "isWinner": false},
			"home": {"team": {"id": 144}, "isWinner": false}
		}
	}]}]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 0 {
		t.Fatalf("undecided Final should be skipped, got %+v", out.Points)
	}
}

func Test_parseRecordTimeline_flattensMultipleDateBuckets(t *testing.T) {
	raw := []byte(`{"dates":[
		{"games":[{
			"officialDate": "2026-04-07",
			"gameDate": "2026-04-07T18:00:00Z",
			"status": {"abstractGameState": "Final"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 121}, "isWinner": false}, "home": {"team": {"id": 144}, "isWinner": true}}
		}]},
		{"games":[{
			"officialDate": "2026-04-08",
			"gameDate": "2026-04-08T18:00:00Z",
			"status": {"abstractGameState": "Final"},
			"isTie": false,
			"teams": {"away": {"team": {"id": 121}, "isWinner": true}, "home": {"team": {"id": 144}, "isWinner": false}}
		}]}
	]}`)
	out, err := parseRecordTimeline(raw, 121, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Points) != 2 {
		t.Fatalf("got %d points", len(out.Points))
	}
	if out.Points[0].Result != "L" || out.Points[1].Result != "W" {
		t.Fatalf("results: %+v %+v", out.Points[0], out.Points[1])
	}
	if out.Points[1].Wins != 1 || out.Points[1].Losses != 1 {
		t.Fatalf("after split: w=%d l=%d", out.Points[1].Wins, out.Points[1].Losses)
	}
	if math.Abs(out.Points[1].Pct-0.5) > 1e-9 {
		t.Fatalf("pct: %v", out.Points[1].Pct)
	}
}
