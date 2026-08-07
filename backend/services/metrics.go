package services

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Low-cardinality process metrics for cache coalescing and upstream courtesy.
// Scraped via GET /metrics (default registry). Do not add unbounded label values
// (e.g. cache keys, full paths).
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
)

func init() {
	// Prime low-cardinality series so /metrics shows them at 0 before first Inc.
	cacheRequests.WithLabelValues("hit")
	cacheRequests.WithLabelValues("miss")
	for _, upstream := range []string{"mlb", "savant"} {
		for _, class := range []string{"429", "5xx"} {
			upstreamHTTP.WithLabelValues(upstream, class)
		}
	}
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

func recordUpstreamHTTPStatus(upstream string, statusCode int) {
	switch {
	case statusCode == http.StatusTooManyRequests:
		upstreamHTTP.WithLabelValues(upstream, "429").Inc()
	case statusCode >= 500 && statusCode <= 599:
		upstreamHTTP.WithLabelValues(upstream, "5xx").Inc()
	}
}
