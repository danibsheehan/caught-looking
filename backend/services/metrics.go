package services

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	dto "github.com/prometheus/client_model/go"
)

// Low-cardinality process metrics for cache coalescing, latency, and upstream courtesy.
// Scraped via GET /metrics (default registry). Do not add unbounded label values
// (e.g. cache keys, raw paths with ids, full URLs).
var (
	cacheRequests = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "caught_looking_cache_requests_total",
			Help: "TTLCache GetOrLoad / GetOrLoadWithTTL outcomes (hit = served from cache, miss = load ran).",
		},
		[]string{"result"}, // hit | miss
	)
	cacheCoalesce = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "caught_looking_cache_coalesce_total",
			Help: "GetOrLoad callers that shared a singleflight result with at least one peer.",
		},
	)
	upstreamHTTP = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "caught_looking_upstream_http_total",
			Help: "Upstream MLB/Savant HTTP responses classified as 429 or 5xx (each attempt, including retries).",
		},
		[]string{"upstream", "class"}, // mlb|savant, 429|5xx
	)

	// Latency histograms — buckets cover warm hits (ms) through cold Statcast-ish loads (~30s).
	latencyBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 30}

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "caught_looking_http_request_duration_seconds",
			Help:    "Inbound HTTP request duration by chi route pattern and status class.",
			Buckets: latencyBuckets,
		},
		[]string{"route", "code"}, // route = chi pattern or "unmatched"; code = 2xx|4xx|5xx
	)
	cacheLoadDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "caught_looking_cache_load_duration_seconds",
			Help:    "TTLCache miss load() duration (singleflight leader only), including upstream work inside the load.",
			Buckets: latencyBuckets,
		},
		[]string{"result"}, // ok | error
	)
	upstreamHTTPDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "caught_looking_upstream_http_duration_seconds",
			Help:    "Outbound MLB/Savant HTTP attempt duration (each try, including retries).",
			Buckets: latencyBuckets,
		},
		[]string{"upstream"}, // mlb | savant
	)
)

func init() {
	// Prime low-cardinality series so /metrics shows them at 0 before first Inc/Observe.
	cacheRequests.WithLabelValues("hit")
	cacheRequests.WithLabelValues("miss")
	for _, upstream := range []string{"mlb", "savant"} {
		for _, class := range []string{"429", "5xx"} {
			upstreamHTTP.WithLabelValues(upstream, class)
		}
		upstreamHTTPDuration.WithLabelValues(upstream)
	}
	cacheLoadDuration.WithLabelValues("ok")
	cacheLoadDuration.WithLabelValues("error")
}

func recordCacheHit() {
	cacheRequests.WithLabelValues("hit").Inc()
}

func recordCacheMiss() {
	cacheRequests.WithLabelValues("miss").Inc()
}

func recordCacheCoalesce() {
	cacheCoalesce.Inc()
}

func recordCacheLoadDuration(d time.Duration, ok bool) {
	result := "error"
	if ok {
		result = "ok"
	}
	cacheLoadDuration.WithLabelValues(result).Observe(d.Seconds())
}

func recordUpstreamHTTPStatus(upstream string, statusCode int) {
	switch {
	case statusCode == http.StatusTooManyRequests:
		upstreamHTTP.WithLabelValues(upstream, "429").Inc()
	case statusCode >= 500 && statusCode <= 599:
		upstreamHTTP.WithLabelValues(upstream, "5xx").Inc()
	}
}

func recordUpstreamHTTPDuration(upstream string, d time.Duration) {
	upstreamHTTPDuration.WithLabelValues(upstream).Observe(d.Seconds())
}

// RecordHTTPRequestDuration observes inbound request latency. route should be a chi
// route pattern (e.g. /games/{gamePk}/boxscore) or "unmatched"; codeClass is 2xx|4xx|5xx.
func RecordHTTPRequestDuration(route, codeClass string, d time.Duration) {
	if route == "" {
		route = "unmatched"
	}
	switch codeClass {
	case "2xx", "4xx", "5xx":
	default:
		codeClass = "2xx"
	}
	httpRequestDuration.WithLabelValues(route, codeClass).Observe(d.Seconds())
}

// HTTPStatusClass maps an HTTP status code to a low-cardinality histogram label.
func HTTPStatusClass(code int) string {
	switch {
	case code >= 500:
		return "5xx"
	case code >= 400:
		return "4xx"
	default:
		return "2xx"
	}
}

// HTTPRequestDurationSampleCount returns the histogram sample count for tests
// (middleware package verifies Logger observes this metric).
func HTTPRequestDurationSampleCount(route, codeClass string) (uint64, error) {
	m, err := httpRequestDuration.GetMetricWithLabelValues(route, codeClass)
	if err != nil {
		return 0, err
	}
	var pb dto.Metric
	if err := m.(prometheus.Metric).Write(&pb); err != nil {
		return 0, err
	}
	return pb.GetHistogram().GetSampleCount(), nil
}
