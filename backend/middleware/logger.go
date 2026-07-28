package middleware

import (
	"log"
	"net/http"
	"time"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// Logger logs one structured line per request: method, path, status, duration, request_id.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &wrapResponseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(ww, r)
		reqID := chimiddleware.GetReqID(r.Context())
		log.Printf("method=%s path=%s status=%d duration=%s request_id=%s",
			r.Method, r.URL.Path, ww.status, time.Since(start).Round(time.Millisecond), reqID)
	})
}

type wrapResponseWriter struct {
	http.ResponseWriter
	status int
}

func (w *wrapResponseWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}
