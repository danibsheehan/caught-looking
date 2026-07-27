package services

import (
	"net/http"
	"strings"
	"testing"
	"time"
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
