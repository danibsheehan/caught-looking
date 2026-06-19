package middleware

import (
	"net/http"
	"time"

	"github.com/go-chi/httprate"
)

// HTTPRateLimit enforces a sliding-window limit per direct client IP from Request.RemoteAddr.
// Forwarded IP headers are intentionally ignored unless a trusted-proxy layer rewrites RemoteAddr.
// If maxRequests <= 0, the handler is a no-op.
func HTTPRateLimit(maxRequests int, window time.Duration) func(http.Handler) http.Handler {
	if maxRequests <= 0 || window <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	return httprate.Limit(maxRequests, window,
		httprate.WithKeyFuncs(httprate.KeyByIP),
		httprate.WithLimitHandler(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"too many requests"}`))
		}),
	)
}
