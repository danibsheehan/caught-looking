package services

import (
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
