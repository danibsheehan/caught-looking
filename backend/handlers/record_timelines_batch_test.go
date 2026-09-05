package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

func TestRecordTimelinesBatch_validation(t *testing.T) {
	h := newTestHandlers(t, http.NotFoundHandler())
	r := chi.NewRouter()
	r.Get("/record-timelines/batch", h.RecordTimelinesBatch)

	tests := []struct {
		path       string
		wantStatus int
	}{
		{"/record-timelines/batch", http.StatusBadRequest},
		{"/record-timelines/batch?teamIds=abc", http.StatusBadRequest},
		{"/record-timelines/batch?teamIds=-1", http.StatusBadRequest},
		{"/record-timelines/batch?teamIds=1,2,3,4,5,6,7,8,9", http.StatusBadRequest},
		{"/record-timelines/batch?teamIds=1&season=1700", http.StatusBadRequest},
	}
	for _, tt := range tests {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, tt.path, nil)
		r.ServeHTTP(rec, req)
		if rec.Code != tt.wantStatus {
			t.Errorf("%s: status %d want %d", tt.path, rec.Code, tt.wantStatus)
		}
	}
}

func TestRecordTimelinesBatch_success(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/schedule" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(scheduleOneFinalGame))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/record-timelines/batch", h.RecordTimelinesBatch)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/record-timelines/batch?teamIds=144,121&season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out models.RecordTimelinesBatchResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Season != 2026 || len(out.Timelines) != 2 {
		t.Fatalf("meta: %+v", out)
	}
	// team ids sorted: 121, 144
	if out.Timelines[0].TeamID != 121 || out.Timelines[1].TeamID != 144 {
		t.Fatalf("order: %#v", out.Timelines)
	}
}

func TestRecordTimelinesBatch_dedupesTeamIDs(t *testing.T) {
	var scheduleCalls int
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/schedule" {
			http.NotFound(w, r)
			return
		}
		scheduleCalls++
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(scheduleOneFinalGame))
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/record-timelines/batch", h.RecordTimelinesBatch)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/record-timelines/batch?teamIds=121,121,121&season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	if scheduleCalls != 1 {
		t.Fatalf("schedule calls: %d want 1", scheduleCalls)
	}
	var out models.RecordTimelinesBatchResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if len(out.Timelines) != 1 {
		t.Fatalf("timelines: %d", len(out.Timelines))
	}
}

func TestRecordTimelinesBatch_upstreamError(t *testing.T) {
	mlb := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	})
	h := newTestHandlers(t, mlb)
	r := chi.NewRouter()
	r.Get("/record-timelines/batch", h.RecordTimelinesBatch)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/record-timelines/batch?teamIds=144,121&season=2026", nil)
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status: got %d", rec.Code)
	}
}
