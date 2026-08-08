package middleware

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"caught-looking/backend/services"

	"github.com/go-chi/chi/v5"
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
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo})))
	t.Cleanup(func() { slog.SetDefault(prev) })

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

func TestLogger_recordsHTTPDurationHistogram(t *testing.T) {
	r := chi.NewRouter()
	r.Use(Logger)
	r.Get("/standings", func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(5 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	})

	before, err := services.HTTPRequestDurationSampleCount("/standings", "2xx")
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/standings", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	after, err := services.HTTPRequestDurationSampleCount("/standings", "2xx")
	if err != nil {
		t.Fatal(err)
	}
	if after-before != 1 {
		t.Fatalf("http duration samples for /standings 2xx: got %d want 1", after-before)
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
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo})))
	t.Cleanup(func() { slog.SetDefault(prev) })

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

func TestWrapResponseWriter_UnwrapAndFlush(t *testing.T) {
	rec := httptest.NewRecorder()
	ww := &wrapResponseWriter{ResponseWriter: rec, status: http.StatusOK}
	if ww.Unwrap() != rec {
		t.Fatal("Unwrap should return underlying ResponseWriter")
	}
	ww.Flush() // httptest.ResponseRecorder implements http.Flusher
	if _, _, err := ww.Hijack(); err == nil {
		t.Fatal("expected Hijack error for ResponseRecorder")
	}
}

func TestMaxBodyBytes_contentLengthOverLimit(t *testing.T) {
	var innerCalled bool
	h := MaxBodyBytes(8)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		innerCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	body := strings.Repeat("x", 16)
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.ContentLength = int64(len(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if innerCalled {
		t.Fatal("inner handler should not run when Content-Length exceeds cap")
	}
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status: got %d want 413", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "request body too large") {
		t.Fatalf("body: %q", rec.Body.String())
	}
}

func TestMaxBodyBytes_underLimitAllowsHandler(t *testing.T) {
	var read int
	h := MaxBodyBytes(64)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("ReadAll: %v", err)
		}
		read = len(b)
		w.WriteHeader(http.StatusOK)
	}))

	body := "hello"
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	if read != len(body) {
		t.Fatalf("read: got %d want %d", read, len(body))
	}
}

func TestMaxBodyBytes_disabledNoops(t *testing.T) {
	var n int
	h := MaxBodyBytes(0)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n++
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(strings.Repeat("y", 1024)))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || n != 1 {
		t.Fatalf("status=%d n=%d", rec.Code, n)
	}
}

func TestMaxBodyBytes_readExceedsWithoutContentLength(t *testing.T) {
	h := MaxBodyBytes(8)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err == nil {
			t.Error("expected MaxBytesReader error")
		}
		w.WriteHeader(http.StatusOK)
	}))

	// ContentLength -1: chunked-style unknown length; MaxBytesReader enforces on read.
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(strings.Repeat("z", 32)))
	req.ContentLength = -1
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
}
