package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRespondUpstreamError_clientCanceled(t *testing.T) {
	rec := httptest.NewRecorder()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/x", nil).WithContext(ctx)

	respondUpstreamError(rec, req, context.Canceled)
	if rec.Code != http.StatusOK || rec.Body.Len() != 0 {
		// httptest defaults Code to 200; ensure we did not write an error body.
		t.Fatalf("canceled: code=%d body=%q (want no write)", rec.Code, rec.Body.String())
	}
}

func TestRespondUpstreamError_requestDeadline(t *testing.T) {
	rec := httptest.NewRecorder()
	ctx, cancel := context.WithTimeout(context.Background(), 0)
	defer cancel()
	<-ctx.Done()
	req := httptest.NewRequest(http.MethodGet, "/x", nil).WithContext(ctx)

	respondUpstreamError(rec, req, context.DeadlineExceeded)
	if rec.Code != http.StatusGatewayTimeout {
		t.Fatalf("status: got %d want 504", rec.Code)
	}
}

func TestRespondUpstreamError_upstreamFailure(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)

	respondUpstreamError(rec, req, context.DeadlineExceeded)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("upstream timeout without request deadline: got %d want 502", rec.Code)
	}
}
