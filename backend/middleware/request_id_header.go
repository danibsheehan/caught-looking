package middleware

import (
	"net/http"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// RequestIDHeader writes the chi RequestID onto the response as X-Request-ID so
// clients (and CORS-exposed browsers) can correlate with slog request_id.
// Register immediately after chimiddleware.RequestID.
func RequestIDHeader(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if reqID := chimiddleware.GetReqID(r.Context()); reqID != "" {
			w.Header().Set("X-Request-ID", reqID)
		}
		next.ServeHTTP(w, r)
	})
}
