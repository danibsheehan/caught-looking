package services

import (
	"context"
	"math"
	"net/http"
	"strings"
	"time"

	"golang.org/x/time/rate"
)

const savantUserAgent = "caught-looking/0.1 (+https://github.com) savant csv client"

const defaultSavantHTTPTimeout = 30 * time.Second

// SavantClient performs GET requests against baseballsavant.mlb.com (or a compatible base URL).
type SavantClient struct {
	baseURL    string
	httpClient *http.Client
	transport  *http.Transport
	upstream   *rate.Limiter
}

// NewSavantClient returns a client for the given base URL. maxQPS caps outbound GET rate per process
// (token bucket); use 0 for no limit (e.g. tests). reqTimeout is the per-attempt HTTP client
// deadline (including reading the body); use 0 for the default (30s). Retries once on transient
// network errors and HTTP 429/503 (honoring Retry-After when present).
func NewSavantClient(baseURL string, maxQPS float64, reqTimeout time.Duration) *SavantClient {
	if reqTimeout <= 0 {
		reqTimeout = defaultSavantHTTPTimeout
	}
	t := cloneUpstreamTransport(reqTimeout)
	c := &SavantClient{
		baseURL:   strings.TrimRight(baseURL, "/"),
		transport: t,
		httpClient: &http.Client{
			Timeout:   reqTimeout,
			Transport: t,
		},
	}
	if maxQPS > 0 {
		burst := int(math.Ceil(math.Max(2, math.Min(maxQPS, 20))))
		c.upstream = rate.NewLimiter(rate.Limit(maxQPS), burst)
	}
	return c
}

// Get issues GET baseURL+path (path must start with /, may include query string) and returns the response body.
func (c *SavantClient) Get(ctx context.Context, path string) ([]byte, error) {
	return upstreamGET{
		name:      "savant",
		baseURL:   c.baseURL,
		accept:    "text/csv,*/*;q=0.8",
		userAgent: savantUserAgent,
		client:    c.httpClient,
		transport: c.transport,
		limiter:   c.upstream,
	}.do(ctx, path)
}
