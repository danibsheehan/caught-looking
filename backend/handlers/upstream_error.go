package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
)

// respondUpstreamError logs err (which may include MLB paths or truncated response bodies from
// services.MLBClient) and writes a generic 502. Never pass err.Error() to clients for upstream failures.
// Client aborts (context.Canceled) are logged and left without a response body write.
func respondUpstreamError(w http.ResponseWriter, r *http.Request, err error) {
	if err == nil {
		return
	}
	if errors.Is(err, context.Canceled) || errors.Is(r.Context().Err(), context.Canceled) {
		log.Printf("%s %s: client canceled", r.Method, r.URL.Path)
		return
	}
	if errors.Is(err, context.DeadlineExceeded) && errors.Is(r.Context().Err(), context.DeadlineExceeded) {
		log.Printf("%s %s: request deadline exceeded: %v", r.Method, r.URL.Path, err)
		http.Error(w, "gateway timeout", http.StatusGatewayTimeout)
		return
	}
	log.Printf("%s %s: upstream error: %v", r.Method, r.URL.Path, err)
	http.Error(w, "bad gateway", http.StatusBadGateway)
}
