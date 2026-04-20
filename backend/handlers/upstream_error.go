package handlers

import (
	"log"
	"net/http"
)

// respondUpstreamError logs err (which may include MLB paths or truncated response bodies from
// services.MLBClient) and writes a generic 502. Never pass err.Error() to clients for upstream failures.
func respondUpstreamError(w http.ResponseWriter, r *http.Request, err error) {
	log.Printf("%s %s: upstream error: %v", r.Method, r.URL.Path, err)
	http.Error(w, "bad gateway", http.StatusBadGateway)
}
