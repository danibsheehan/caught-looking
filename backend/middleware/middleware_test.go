package middleware

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
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
	if !strings.Contains(line, "method=POST") || !strings.Contains(line, "path=/v1/standings") || !strings.Contains(line, "status=418") || !strings.Contains(line, "request_id=") {
		t.Fatalf("log line missing structured fields: %q", strings.TrimSpace(line))
	}
}

func TestHTTPRateLimit_exceedsReturns429(t *testing.T) {
	h := HTTPRateLimit(2, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	const addr = "192.0.2.1:1234"
	for range 2 {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = addr
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = addr
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "too many requests") {
		t.Fatalf("body: %q", rec.Body.String())
	}
}

func TestHTTPRateLimit_disabledNoops(t *testing.T) {
	var n int
	h := HTTPRateLimit(0, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n++
		w.WriteHeader(http.StatusOK)
	}))
	for range 10 {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "192.0.2.2:1"
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("got %d", rec.Code)
		}
	}
	if n != 10 {
		t.Fatalf("handler calls: got %d want 10", n)
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
	if !strings.Contains(line, "method=GET") || !strings.Contains(line, "path=/implicit") || !strings.Contains(line, "status=200") {
		t.Fatalf("log line: %q", strings.TrimSpace(line))
	}
}
