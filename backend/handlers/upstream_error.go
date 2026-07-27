package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// respondUpstreamError logs err (which may include MLB paths or truncated response bodies from
// services.MLBClient) and writes a generic 502. Never pass err.Error() to clients for upstream failures.
// Client aborts (context.Canceled) are logged and left without a response body write.
func respondUpstreamError(w http.ResponseWriter, r *http.Request, err error) {
	if err == nil {
		return
	}
	reqID := chimiddleware.GetReqID(r.Context())
	if errors.Is(err, context.Canceled) || errors.Is(r.Context().Err(), context.Canceled) {
		log.Printf("request_id=%s method=%s path=%s event=client_canceled", reqID, r.Method, r.URL.Path)
		return
	}
	if errors.Is(err, context.DeadlineExceeded) && errors.Is(r.Context().Err(), context.DeadlineExceeded) {
		log.Printf("request_id=%s method=%s path=%s event=request_deadline err=%v", reqID, r.Method, r.URL.Path, err)
		respondAPIError(w, http.StatusGatewayTimeout, "gateway timeout")
		return
	}
	log.Printf("request_id=%s method=%s path=%s event=upstream_error err=%v", reqID, r.Method, r.URL.Path, err)
	respondAPIError(w, http.StatusBadGateway, "bad gateway")
}
