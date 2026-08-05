package middleware

import (
	"net/http"
)

// MaxBodyBytes caps the inbound request body. When maxBytes <= 0, it is a no-op.
// Content-Length over the limit is rejected with 413 before the handler runs;
// http.MaxBytesReader still wraps Body so chunked/unknown-length reads cannot exceed the cap.
func MaxBodyBytes(maxBytes int64) func(http.Handler) http.Handler {
	if maxBytes <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.ContentLength > maxBytes {
				writeBodyTooLarge(w)
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}

func writeBodyTooLarge(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusRequestEntityTooLarge)
	_, _ = w.Write([]byte(`{"error":"request body too large"}`))
}
