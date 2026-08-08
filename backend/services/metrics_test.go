package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
)

func TestCacheMetrics_hitMissCoalesce(t *testing.T) {
	hitsBefore := testutil.ToFloat64(cacheRequests.WithLabelValues("hit"))
	missBefore := testutil.ToFloat64(cacheRequests.WithLabelValues("miss"))
	coalBefore := testutil.ToFloat64(cacheCoalesce)
	loadOKBefore := histogramSampleCount(t, cacheLoadDuration, "ok")

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
	if got := histogramSampleCount(t, cacheLoadDuration, "ok") - loadOKBefore; got != 1 {
		t.Fatalf("cache load ok samples: got %d want 1", got)
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
	if got := histogramSampleCount(t, cacheLoadDuration, "ok") - loadOKBefore; got != 1 {
		t.Fatalf("cache load must not observe on hit: got %d want 1", got)
	}
}

func TestCacheMetrics_loadErrorObservesError(t *testing.T) {
	errBefore := histogramSampleCount(t, cacheLoadDuration, "error")
	c := NewTTLCache()
	_, _, err := c.GetOrLoad(context.Background(), "metrics-load-err", time.Hour, func(context.Context) ([]byte, error) {
		return nil, context.DeadlineExceeded
	})
	if err == nil {
		t.Fatal("expected load error")
	}
	if got := histogramSampleCount(t, cacheLoadDuration, "error") - errBefore; got != 1 {
		t.Fatalf("cache load error samples: got %d want 1", got)
	}
}

func TestUpstreamMetrics_429And5xx(t *testing.T) {
	mlb429Before := testutil.ToFloat64(upstreamHTTP.WithLabelValues("mlb", "429"))
	mlb5xxBefore := testutil.ToFloat64(upstreamHTTP.WithLabelValues("mlb", "5xx"))
	durBefore := histogramSampleCount(t, upstreamHTTPDuration, "mlb")

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
	if got := histogramSampleCount(t, upstreamHTTPDuration, "mlb") - durBefore; got != 2 {
		t.Fatalf("mlb upstream duration samples: got %d want 2 (retry)", got)
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

func TestHTTPStatusClass(t *testing.T) {
	cases := []struct {
		code int
		want string
	}{
		{200, "2xx"},
		{301, "2xx"},
		{404, "4xx"},
		{429, "4xx"},
		{500, "5xx"},
		{503, "5xx"},
	}
	for _, tc := range cases {
		if got := HTTPStatusClass(tc.code); got != tc.want {
			t.Fatalf("HTTPStatusClass(%d): got %q want %q", tc.code, got, tc.want)
		}
	}
}

func TestRecordHTTPRequestDuration(t *testing.T) {
	before := histogramSampleCount(t, httpRequestDuration, "/standings", "2xx")
	RecordHTTPRequestDuration("/standings", "2xx", 12*time.Millisecond)
	RecordHTTPRequestDuration("", "bogus", time.Millisecond) // unmatched + clamped 2xx
	if got := histogramSampleCount(t, httpRequestDuration, "/standings", "2xx") - before; got != 1 {
		t.Fatalf("standings 2xx samples: got %d want 1", got)
	}
	if got := histogramSampleCount(t, httpRequestDuration, "unmatched", "2xx"); got < 1 {
		t.Fatalf("expected unmatched 2xx observation, got %d", got)
	}
}

func histogramSampleCount(t *testing.T, vec *prometheus.HistogramVec, labels ...string) uint64 {
	t.Helper()
	m, err := vec.GetMetricWithLabelValues(labels...)
	if err != nil {
		t.Fatalf("GetMetricWithLabelValues: %v", err)
	}
	var pb dto.Metric
	if err := m.(prometheus.Metric).Write(&pb); err != nil {
		t.Fatalf("metric Write: %v", err)
	}
	return pb.GetHistogram().GetSampleCount()
}
