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

const peopleSearchJSON = `{
  "people": [
    {
      "id": 592450,
      "fullName": "Example Player",
      "active": true,
      "primaryNumber": "12",
      "primaryPosition": {"abbreviation": "CF"}
    }
  ]
}`

const teamsListJSON = `{
  "teams": [
    {
      "id": 121,
      "name": "New York Mets",
      "abbreviation": "NYM",
      "teamName": "Mets",
      "active": true,
      "league": {"id": 104, "name": "National League"},
      "division": {"id": 204, "name": "NL East"}
    }
  ]
}`

func TestPlayerSearch_validation(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/players/search", h.PlayerSearch)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/search?names=x", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("short query: status %d", rec.Code)
	}

	long := strings.Repeat("a", 65)
	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/players/search?names="+long, nil)
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("long query: status %d", rec2.Code)
	}
}

func TestPlayerSearch_success_namesAndQ(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/people/search" {
			http.NotFound(w, r)
			return
		}
		if r.URL.Query().Get("names") == "" {
			http.Error(w, "missing names", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(peopleSearchJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/search", h.PlayerSearch)

	for _, q := range []string{"names=Example", "q=Example"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/players/search?"+q, nil)
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status %d", q, rec.Code)
		}
		var out models.PlayersSearchResponse
		if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
			t.Fatal(err)
		}
		if len(out.People) != 1 || out.People[0].FullName != "Example Player" {
			t.Fatalf("%s: %+v", q, out)
		}
		if out.Query != "Example" {
			t.Fatalf("%s: query %q", q, out.Query)
		}
	}
}

func TestPlayerSearch_upstreamError(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/search", h.PlayerSearch)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/search?names=Example", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestTeams_validation(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/teams", h.Teams)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams?sportId=abc", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestTeams_success(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/teams" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(teamsListJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/teams", h.Teams)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/teams", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.TeamsResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if len(out.Teams) != 1 || out.Teams[0].Abbreviation != "NYM" {
		t.Fatalf("teams: %+v", out.Teams)
	}
}

func TestPlayerCurrentTeam_invalidID(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/players/{playerID}/current-team", h.PlayerCurrentTeam)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/x/current-team", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestPlayerCurrentTeam_withTeam(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/people/592450" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"people":[{"id":592450,"currentTeam":{"id":121}}]}`))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/{playerID}/current-team", h.PlayerCurrentTeam)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/592450/current-team", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.PlayerCurrentTeamResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.PlayerID != 592450 || out.TeamID != 121 {
		t.Fatalf("response: %+v", out)
	}
}

func TestPlayersCurrentTeams_ok(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var body string
		switch r.URL.Path {
		case "/people/10":
			body = `{"people":[{"id":10,"currentTeam":{"id":121}}]}`
		case "/people/20":
			body = `{"people":[{"id":20,"currentTeam":{"id":147}}]}`
		default:
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/current-teams", h.PlayersCurrentTeams)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/current-teams?ids=10,20", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.PlayersCurrentTeamsResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if len(out.Players) != 2 {
		t.Fatalf("players len: %+v", out.Players)
	}
	if out.Players[0].PlayerID != 10 || out.Players[0].TeamID != 121 {
		t.Fatalf("p0: %+v", out.Players[0])
	}
	if out.Players[1].PlayerID != 20 || out.Players[1].TeamID != 147 {
		t.Fatalf("p1: %+v", out.Players[1])
	}
}

func TestPlayersCurrentTeams_badIds(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	rt := chi.NewRouter()
	rt.Get("/players/current-teams", h.PlayersCurrentTeams)

	for _, path := range []string{
		"/players/current-teams",
		"/players/current-teams?ids=1",
		"/players/current-teams?ids=1,1",
		"/players/current-teams?ids=x,y",
	} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rt.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: status got %d want 400", path, rec.Code)
		}
	}
}

func TestPlayerCurrentTeam_noTeam(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/people/1" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"people":[{"id":1}]}`))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/{playerID}/current-team", h.PlayerCurrentTeam)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/1/current-team", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var out models.PlayerCurrentTeamResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.TeamID != 0 {
		t.Fatalf("want team 0, got %+v", out)
	}
}
