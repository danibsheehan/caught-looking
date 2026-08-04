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

const leadersHomeRunsJSON = `{
  "leagueLeaders": [
    {
      "leaderCategory": "homeRuns",
      "statGroup": "hitting",
      "leaders": [
        {
          "rank": 1,
          "value": "60",
          "team": {"id": 136, "name": "Seattle Mariners"},
          "league": {"name": "AL"},
          "person": {"id": 663728, "fullName": "Cal Raleigh"}
        },
        {
          "rank": 2,
          "value": "56",
          "team": {"id": 143, "name": "Philadelphia Phillies"},
          "league": {"name": "NL"},
          "person": {"id": 656941, "fullName": "Kyle Schwarber"}
        }
      ]
    }
  ]
}`

func TestLeaders_validation(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/leaders", h.Leaders)

	cases := []struct {
		name string
		url  string
	}{
		{name: "bad season", url: "/leaders?season=abc"},
		{name: "bad group", url: "/leaders?group=fielding"},
		{name: "bad category", url: "/leaders?group=hitting&category=wins"},
		{name: "bad limit", url: "/leaders?limit=0"},
		{name: "limit too high", url: "/leaders?limit=99"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, tc.url, nil)
			r.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestLeaders_success(t *testing.T) {
	var sawPath string
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawPath = r.URL.Path + "?" + r.URL.RawQuery
		if r.URL.Path != "/stats/leaders" {
			http.NotFound(w, r)
			return
		}
		q := r.URL.Query()
		if q.Get("leaderCategories") != "homeRuns" || q.Get("statGroup") != "hitting" || q.Get("season") != "2025" {
			http.Error(w, "bad query", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(leadersHomeRunsJSON))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/leaders", h.Leaders)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/leaders?season=2025&group=hitting&category=homeRuns&limit=5", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s (upstream %s)", rec.Code, rec.Body.String(), sawPath)
	}
	if cc := rec.Header().Get("Cache-Control"); !strings.HasPrefix(cc, "public, max-age=") {
		t.Fatalf("Cache-Control: %q", cc)
	}

	var out models.LeadersResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Season != 2025 || out.Group != "hitting" || out.Category != "homeRuns" || out.Limit != 5 {
		t.Fatalf("meta: %+v", out)
	}
	if len(out.Leaders) != 2 || out.Leaders[0].PlayerName != "Cal Raleigh" || out.Leaders[0].Value != "60" {
		t.Fatalf("leaders: %+v", out.Leaders)
	}
	if len(out.Categories) == 0 || out.Categories[0] != "homeRuns" {
		t.Fatalf("categories: %+v", out.Categories)
	}
}

func TestLeaders_upstreamError(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "down", http.StatusBadGateway)
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/leaders", h.Leaders)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/leaders?season=2025", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status %d", rec.Code)
	}
}
