package services

import (
	"context"
	"fmt"
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
	if path == "" || path[0] != '/' {
		return nil, fmt.Errorf("savant path must start with /, got %q", path)
	}
	u := c.baseURL + path

	if c.upstream != nil {
		if err := c.upstream.Wait(ctx); err != nil {
			return nil, err
		}
	}

	const maxAttempts = 2
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		if attempt > 0 {
			c.transport.CloseIdleConnections()
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Accept", "text/csv,*/*;q=0.8")
		req.Header.Set("User-Agent", savantUserAgent)

		res, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			if attempt+1 < maxAttempts && upstreamRetryable(err) {
				if err := sleepContext(ctx, time.Duration(100*(attempt+1))*time.Millisecond); err != nil {
					return nil, err
				}
				continue
			}
			return nil, err
		}

		body, readErr := readBodyLimited(res.Body, maxUpstreamBodyBytes)
		_ = res.Body.Close()
		if readErr != nil {
			lastErr = readErr
			if attempt+1 < maxAttempts && upstreamRetryable(readErr) {
				if err := sleepContext(ctx, time.Duration(100*(attempt+1))*time.Millisecond); err != nil {
					return nil, err
				}
				continue
			}
			return nil, readErr
		}
		if res.StatusCode < 200 || res.StatusCode >= 300 {
			lastErr = fmt.Errorf("savant GET %s: status %d: %s", path, res.StatusCode, truncate(body, 200))
			if attempt+1 < maxAttempts && upstreamStatusRetryable(res.StatusCode) {
				if err := sleepContext(ctx, retryAfterDelay(res, attempt+1)); err != nil {
					return nil, err
				}
				continue
			}
			return nil, lastErr
		}
		return body, nil
	}
	return nil, lastErr
}
