package services

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/time/rate"
)

func TestUpstreamResponseHeaderTimeout(t *testing.T) {
	// Same shape as the former MLB-only helper: header deadline stays within client timeout.
	if got := upstreamResponseHeaderTimeout(15 * time.Second); got != 10*time.Second {
		t.Fatalf("15s client: got %v want 10s", got)
	}
	if got := upstreamResponseHeaderTimeout(30 * time.Second); got != 20*time.Second {
		t.Fatalf("30s client: got %v want 20s", got)
	}
	if got := upstreamResponseHeaderTimeout(2 * time.Second); got != 1*time.Second {
		t.Fatalf("2s client: got %v want 1s", got)
	}
}

func TestCloneUpstreamTransport_nonNil(t *testing.T) {
	t.Parallel()
	tr := cloneUpstreamTransport(15 * time.Second)
	if tr == nil {
		t.Fatal("expected non-nil transport")
	}
	if tr.MaxIdleConnsPerHost < 1 {
		t.Fatalf("MaxIdleConnsPerHost: %d", tr.MaxIdleConnsPerHost)
	}
}

func TestReadBodyLimited(t *testing.T) {
	t.Parallel()
	ok, err := readBodyLimited(strings.NewReader("hello"), 10)
	if err != nil {
		t.Fatal(err)
	}
	if string(ok) != "hello" {
		t.Fatalf("got %q", ok)
	}
	_, err = readBodyLimited(strings.NewReader(strings.Repeat("x", 5)), 4)
	if err == nil || !strings.Contains(err.Error(), "exceeds") {
		t.Fatalf("got err=%v", err)
	}
}

func TestUpstreamStatusRetryable(t *testing.T) {
	t.Parallel()
	if !upstreamStatusRetryable(http.StatusTooManyRequests) || !upstreamStatusRetryable(http.StatusServiceUnavailable) {
		t.Fatal("429/503 should be retryable")
	}
	if upstreamStatusRetryable(http.StatusNotFound) || upstreamStatusRetryable(http.StatusOK) {
		t.Fatal("404/200 must not be retryable")
	}
}

// TestUpstreamGET_retryReusesConnection proves the retry path no longer closes idle connections:
// a 503-then-200 retry sequence must open exactly one TCP connection to the upstream host.
func TestUpstreamGET_retryReusesConnection(t *testing.T) {
	var reqN atomic.Int32
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if reqN.Add(1) == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	var newConns atomic.Int32
	srv.Config.ConnState = func(_ net.Conn, state http.ConnState) {
		if state == http.StateNew {
			newConns.Add(1)
		}
	}
	srv.Start()
	t.Cleanup(srv.Close)

	u := upstreamGET{
		name:      "test",
		baseURL:   srv.URL,
		accept:    "application/json",
		userAgent: "test",
		client:    srv.Client(),
	}
	body, err := u.do(context.Background(), "/x")
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "ok" {
		t.Fatalf("got %q", body)
	}
	if got := reqN.Load(); got != 2 {
		t.Fatalf("server hits: got %d want 2", got)
	}
	if got := newConns.Load(); got != 1 {
		t.Fatalf("new TCP connections: got %d want 1 (retry should reuse the pooled connection)", got)
	}
}

// TestUpstreamGET_retryWaitsOnLimiter proves a retry attempt waits on the rate limiter like the
// first attempt, so the QPS cap covers every outbound attempt, not just the initial one.
func TestUpstreamGET_retryWaitsOnLimiter(t *testing.T) {
	var reqN atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if reqN.Add(1) == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	t.Cleanup(srv.Close)

	// Burst 1 at 5/sec: the first Wait drains the only token instantly; the retry's Wait must
	// block ~200ms for the next token.
	limiter := rate.NewLimiter(5, 1)
	u := upstreamGET{
		name:      "test",
		baseURL:   srv.URL,
		accept:    "application/json",
		userAgent: "test",
		client:    srv.Client(),
		limiter:   limiter,
	}
	start := time.Now()
	body, err := u.do(context.Background(), "/y")
	elapsed := time.Since(start)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "ok" {
		t.Fatalf("got %q", body)
	}
	if elapsed < 150*time.Millisecond {
		t.Fatalf("expected retry attempt to wait on limiter (~200ms), elapsed=%v", elapsed)
	}
}

func TestRetryAfterDelay(t *testing.T) {
	t.Parallel()
	res := &http.Response{Header: make(http.Header)}
	res.Header.Set("Retry-After", "2")
	if got := retryAfterDelay(res, 1); got != 2*time.Second {
		t.Fatalf("seconds: got %v", got)
	}
	res.Header.Set("Retry-After", "30")
	if got := retryAfterDelay(res, 1); got != maxRetryAfter {
		t.Fatalf("capped: got %v want %v", got, maxRetryAfter)
	}
	res.Header.Del("Retry-After")
	if got := retryAfterDelay(res, 2); got != 200*time.Millisecond {
		t.Fatalf("fallback: got %v", got)
	}
}
