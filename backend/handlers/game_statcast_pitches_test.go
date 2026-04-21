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

const minimalPitchesCSV = `plate_x,plate_z,pitch_name,pitcher,batter,release_speed,inning_topbot,sz_top,sz_bot,stand
-0.42,2.15,4-Seam Fastball,67890,12345,94.2,Top,3.41,1.74,R
0.31,3.05,Slider,67890,12345,87.0,Bot,3.37,1.79,R
`

func TestGameStatcastPitches_invalidGamePk(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/statcast/pitches", h.GameStatcastPitches)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/nope/statcast/pitches", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestGameStatcastPitches_success(t *testing.T) {
	up := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/statcast_search/csv" && strings.Contains(r.URL.RawQuery, "game_pk=777") {
			w.Header().Set("Content-Type", "text/csv")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(minimalPitchesCSV))
			return
		}
		http.NotFound(w, r)
	})
	h := newTestHandlers(t, up)
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/statcast/pitches", h.GameStatcastPitches)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/777/statcast/pitches", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.GameStatcastPitchesResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.GamePk != 777 {
		t.Fatalf("GamePk: %d", out.GamePk)
	}
	if len(out.Pitches) != 2 {
		t.Fatalf("pitches: %d", len(out.Pitches))
	}
	if out.Pitches[0].PlateX != -0.42 || out.Pitches[0].PlateZ != 2.15 {
		t.Fatalf("row0 location: %+v", out.Pitches[0])
	}
	if out.Pitches[0].PitchName != "4-Seam Fastball" || out.Pitches[0].Pitcher != 67890 {
		t.Fatalf("row0 meta: %+v", out.Pitches[0])
	}
	if out.Pitches[0].ReleaseSpeed == nil || *out.Pitches[0].ReleaseSpeed != 94.2 {
		t.Fatalf("row0 speed: %+v", out.Pitches[0].ReleaseSpeed)
	}
	if out.Pitches[0].InningHalf != "Top" || out.Pitches[1].InningHalf != "Bottom" {
		t.Fatalf("half: %+v / %+v", out.Pitches[0].InningHalf, out.Pitches[1].InningHalf)
	}
	if out.Pitches[0].SzTop == nil || *out.Pitches[0].SzTop != 3.41 || out.Pitches[0].SzBot == nil || *out.Pitches[0].SzBot != 1.74 {
		t.Fatalf("row0 sz: %+v / %+v", out.Pitches[0].SzTop, out.Pitches[0].SzBot)
	}
	if out.Pitches[0].BatterStand != "R" || out.Pitches[1].BatterStand != "R" {
		t.Fatalf("batterStand: %+v / %+v", out.Pitches[0].BatterStand, out.Pitches[1].BatterStand)
	}
}

func TestGameStatcastPitches_upstreamError(t *testing.T) {
	h := newTestHandlers(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "err", http.StatusBadGateway)
	}))
	r := chi.NewRouter()
	r.Get("/games/{gamePk}/statcast/pitches", h.GameStatcastPitches)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/games/1/statcast/pitches", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}

func TestParseStatcastPitchesCSV_emptyBody(t *testing.T) {
	got := parseStatcastPitchesCSV(nil)
	if got == nil || len(got) != 0 {
		t.Fatalf("got %v", got)
	}
}

func TestParseStatcastPitchesCSV_missingColumns(t *testing.T) {
	csvNoPlate := `launch_speed,launch_angle,pitcher
95,10,1
`
	got := parseStatcastPitchesCSV([]byte(csvNoPlate))
	if len(got) != 0 {
		t.Fatalf("expected empty, got %d", len(got))
	}
}
