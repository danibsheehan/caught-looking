package middleware

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCORS_allowedOriginGET(t *testing.T) {
	allowed := []string{"http://localhost:5173"}
	h := CORS(allowed)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/foo", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want %d", rec.Code, http.StatusOK)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("Access-Control-Allow-Origin: got %q", got)
	}
}

func TestCORS_OPTIONS_preflight(t *testing.T) {
	allowed := []string{"http://127.0.0.1:5173"}
	var innerCalled bool
	h := CORS(allowed)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		innerCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/foo", nil)
	req.Header.Set("Origin", "http://127.0.0.1:5173")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if innerCalled {
		t.Fatal("inner handler ran for OPTIONS; expected CORS middleware to handle preflight")
	}
	if rec.Code != http.StatusOK && rec.Code != http.StatusNoContent {
		t.Fatalf("status: got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://127.0.0.1:5173" {
		t.Fatalf("Access-Control-Allow-Origin: got %q", got)
	}
}

func TestCORS_disallowedOrigin(t *testing.T) {
	h := CORS([]string{"http://localhost:5173"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("unexpected ACAO for disallowed origin: %q", rec.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestLogger_logsMethodPathStatusAndDuration(t *testing.T) {
	var buf bytes.Buffer
	prev := log.Default().Writer()
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(prev) })

	h := Logger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))

	req := httptest.NewRequest(http.MethodPost, "/v1/standings", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusTeapot {
		t.Fatalf("recorder status: got %d", rec.Code)
	}

	line := buf.String()
	if !strings.Contains(line, "POST") || !strings.Contains(line, "/v1/standings") || !strings.Contains(line, "418") {
		t.Fatalf("log line missing method, path, or status: %q", strings.TrimSpace(line))
	}
}

func TestLogger_defaultStatusOKWhenNoWriteHeader(t *testing.T) {
	var buf bytes.Buffer
	prev := log.Default().Writer()
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(prev) })

	h := Logger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("hi"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/implicit", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	line := buf.String()
	if !strings.Contains(line, "GET") || !strings.Contains(line, "/implicit") || !strings.Contains(line, "200") {
		t.Fatalf("log line: %q", strings.TrimSpace(line))
	}
}
