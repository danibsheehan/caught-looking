package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestCacheMetrics_hitMissCoalesce(t *testing.T) {
	hitsBefore := testutil.ToFloat64(cacheRequests.WithLabelValues("hit"))
	missBefore := testutil.ToFloat64(cacheRequests.WithLabelValues("miss"))
	coalBefore := testutil.ToFloat64(cacheCoalesce)

	c := NewTTLCache()
	const n = 12
	var wg sync.WaitGroup
	wg.Add(n)
	errCh := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			_, _, err := c.GetOrLoad(context.Background(), "metrics-coalesce", time.Hour, func(context.Context) ([]byte, error) {
				time.Sleep(40 * time.Millisecond)
				return []byte("ok"), nil
			})
			if err != nil {
				errCh <- err
			}
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}

	missDelta := testutil.ToFloat64(cacheRequests.WithLabelValues("miss")) - missBefore
	coalDelta := testutil.ToFloat64(cacheCoalesce) - coalBefore
	if missDelta != 1 {
		t.Fatalf("miss delta: got %v want 1", missDelta)
	}
	if coalDelta < 1 {
		t.Fatalf("coalesce delta: got %v want >= 1", coalDelta)
	}

	_, _, err := c.GetOrLoad(context.Background(), "metrics-coalesce", time.Hour, func(context.Context) ([]byte, error) {
		t.Fatal("load must not run on hit")
		return nil, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	hitDelta := testutil.ToFloat64(cacheRequests.WithLabelValues("hit")) - hitsBefore
	if hitDelta < 1 {
		t.Fatalf("hit delta after cached GetOrLoad: got %v want >= 1", hitDelta)
	}
}

func TestUpstreamMetrics_429And5xx(t *testing.T) {
	mlb429Before := testutil.ToFloat64(upstreamHTTP.WithLabelValues("mlb", "429"))
	mlb5xxBefore := testutil.ToFloat64(upstreamHTTP.WithLabelValues("mlb", "5xx"))

	var n int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		n++
		if n == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte("slow"))
			return
		}
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("upstream"))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL, 0, 0)
	_, err := c.Get(context.Background(), "/metrics-upstream")
	if err == nil {
		t.Fatal("expected error after 429 then 502")
	}

	if got := testutil.ToFloat64(upstreamHTTP.WithLabelValues("mlb", "429")) - mlb429Before; got != 1 {
		t.Fatalf("mlb 429 delta: got %v want 1", got)
	}
	if got := testutil.ToFloat64(upstreamHTTP.WithLabelValues("mlb", "5xx")) - mlb5xxBefore; got != 1 {
		t.Fatalf("mlb 5xx delta: got %v want 1", got)
	}
}

func TestRecordUpstreamHTTPStatus_ignoresOtherCodes(t *testing.T) {
	before := testutil.ToFloat64(upstreamHTTP.WithLabelValues("savant", "429"))
	recordUpstreamHTTPStatus("savant", http.StatusNotFound)
	recordUpstreamHTTPStatus("savant", http.StatusOK)
	if got := testutil.ToFloat64(upstreamHTTP.WithLabelValues("savant", "429")) - before; got != 0 {
		t.Fatalf("unexpected 429 increment: %v", got)
	}
}
