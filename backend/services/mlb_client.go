package services

import (
	"context"
	"errors"
	"math"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/time/rate"
)

const defaultMLBHTTPTimeout = 15 * time.Second

const mlbUserAgent = "caught-looking/0.1 (+https://github.com) statsapi client"

// MLBClient performs GET requests against statsapi.mlb.com (or a compatible base URL).
type MLBClient struct {
	baseURL    string
	httpClient *http.Client
	transport  *http.Transport
	upstream   *rate.Limiter
}

// NewMLBClient returns a client for the given base URL. maxQPS caps outbound GET rate per process
// (token bucket); use 0 for no limit (e.g. tests). reqTimeout is the per-attempt HTTP client
// deadline (including reading the body); use 0 for the default (15s).
func NewMLBClient(baseURL string, maxQPS float64, reqTimeout time.Duration) *MLBClient {
	if reqTimeout <= 0 {
		reqTimeout = defaultMLBHTTPTimeout
	}

	t := cloneUpstreamTransport(reqTimeout)

	c := &MLBClient{
		baseURL:   strings.TrimRight(baseURL, "/"),
		transport: t,
		httpClient: &http.Client{
			Timeout:   reqTimeout,
			Transport: t,
		},
	}
	if maxQPS > 0 {
		burst := int(math.Ceil(math.Max(5, math.Min(maxQPS, 50))))
		c.upstream = rate.NewLimiter(rate.Limit(maxQPS), burst)
	}
	return c
}

// Get issues GET baseURL+path (path must start with /) and returns the response body.
func (c *MLBClient) Get(ctx context.Context, path string) ([]byte, error) {
	return upstreamGET{
		name:      "mlb",
		baseURL:   c.baseURL,
		accept:    "application/json",
		userAgent: mlbUserAgent,
		client:    c.httpClient,
		transport: c.transport,
		limiter:   c.upstream,
	}.do(ctx, path)
}

func sleepContext(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

func upstreamRetryable(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var ne net.Error
	if errors.As(err, &ne) && ne.Timeout() {
		return true
	}
	msg := err.Error()
	switch {
	case strings.Contains(msg, "Client.Timeout"):
		return true
	case strings.Contains(msg, "timeout awaiting response headers"):
		return true
	case strings.Contains(msg, "connection reset"):
		return true
	case strings.Contains(msg, "broken pipe"):
		return true
	case strings.Contains(msg, "TLS handshake timeout"):
		return true
	case strings.Contains(msg, "unexpected EOF"):
		return true
	case strings.Contains(msg, "use of closed network connection"):
		return true
	}
	var ue *url.Error
	if errors.As(err, &ue) {
		return upstreamRetryable(ue.Err)
	}
	return false
}

func truncate(b []byte, n int) string {
	s := string(b)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
