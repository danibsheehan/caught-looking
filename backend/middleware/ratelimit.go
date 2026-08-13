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
	// TODO: httprate.Limit/KeyByIP are deprecated in favor of LimitBy(requestLimit,
	// windowLength, keyFn, ...). Deferred to a focused follow-up PR rather than fixed here --
	// it's an API migration on the RemoteAddr/forwarded-header trust model documented in
	// docs/threat-model.md, not a mechanical cleanup, and deserves its own review.
	return httprate.Limit(maxRequests, window, //nolint:staticcheck // see TODO above
		httprate.WithKeyFuncs(httprate.KeyByIP), //nolint:staticcheck // see TODO above
		httprate.WithLimitHandler(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"too many requests"}`))
		}),
	)
}
