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

func TestPlayersComparePlatoon_validation(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/players/compare/platoon", h.PlayersComparePlatoon)

	tests := []string{
		"/players/compare/platoon?ids=1",
		"/players/compare/platoon?ids=1,2&season=1700",
		"/players/compare/platoon?ids=1,2&group=fielding",
	}
	for _, path := range tests {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d", path, rec.Code)
		}
	}
}

func TestPlayersComparePlatoon_success_hitting(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/people/") || !strings.HasSuffix(r.URL.Path, "/stats") {
			http.NotFound(w, r)
			return
		}
		q := r.URL.Query()
		if q.Get("stats") != "statSplits" || q.Get("group") != "hitting" || q.Get("season") != "2026" {
			http.Error(w, "bad query", http.StatusBadRequest)
			return
		}
		if q.Get("sitCodes") != "vl,vr" {
			http.Error(w, "want sitCodes", http.StatusBadRequest)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		id := parts[1]
		body := `{"stats":[{"splits":[
			{"split":{"code":"vl","description":"vs Left"},"player":{"id":` + id + `,"fullName":"P` + id + `"},"stat":{"ops":"1.100","plateAppearances":50}},
			{"split":{"code":"vr","description":"vs Right"},"player":{"id":` + id + `,"fullName":"P` + id + `"},"stat":{"ops":0.9,"plateAppearances":200}}
		]}]}`
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/players/compare/platoon", h.PlayersComparePlatoon)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/players/compare/platoon?ids=7,8&group=hitting&season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.PlayersPlatoonResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Season != 2026 || out.Group != "hitting" || out.Metric != "ops" {
		t.Fatalf("meta: %+v", out)
	}
	if len(out.Players) != 2 {
		t.Fatalf("players: %d", len(out.Players))
	}
	if len(out.Players[0].Splits) != 2 || out.Players[0].Splits[0].Code != "vl" {
		t.Fatalf("p1 splits: %+v", out.Players[0].Splits)
	}
	if out.Players[0].Splits[0].Ops != 1.1 || out.Players[0].Splits[0].Sample != 50 {
		t.Fatalf("vl row: %+v", out.Players[0].Splits[0])
	}
}
