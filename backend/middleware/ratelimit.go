package middleware

import (
	"net/http"
	"time"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httprate"
)

// HTTPRateLimit enforces a sliding-window limit per direct client IP. The key is read from
// chi's ClientIPFromRemoteAddr (see router.go — must run earlier in the same middleware chain),
// which resolves to Request.RemoteAddr: the direct TCP peer. Forwarded IP headers are
// intentionally ignored unless a trusted-proxy layer resolves the client IP differently
// (e.g. chimiddleware.ClientIPFromXFF) before this middleware runs.
// If maxRequests <= 0, the handler is a no-op.
func HTTPRateLimit(maxRequests int, window time.Duration) func(http.Handler) http.Handler {
	if maxRequests <= 0 || window <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	return httprate.LimitBy(maxRequests, window, func(r *http.Request) (string, error) {
		return httprate.CanonicalizeIP(chimiddleware.GetClientIP(r.Context())), nil
	},
		httprate.WithLimitHandler(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"too many requests"}`))
		}),
	)
}
