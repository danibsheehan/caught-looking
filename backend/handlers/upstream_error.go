package handlers

import (
	"context"
	"errors"
	"log/slog"
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
		slog.Info("client_canceled",
			"request_id", reqID,
			"method", r.Method,
			"path", r.URL.Path,
		)
		return
	}
	if errors.Is(err, context.DeadlineExceeded) && errors.Is(r.Context().Err(), context.DeadlineExceeded) {
		slog.Warn("request_deadline",
			"request_id", reqID,
			"method", r.Method,
			"path", r.URL.Path,
			"err", err,
		)
		respondAPIError(w, http.StatusGatewayTimeout, "gateway timeout")
		return
	}
	slog.Error("upstream_error",
		"request_id", reqID,
		"method", r.Method,
		"path", r.URL.Path,
		"err", err,
	)
	respondAPIError(w, http.StatusBadGateway, "bad gateway")
}
