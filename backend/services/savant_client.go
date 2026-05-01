package services

import (
	"context"
	"fmt"
	"io"
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
	upstream   *rate.Limiter
}

// NewSavantClient returns a client for the given base URL. maxQPS caps outbound GET rate per process
// (token bucket); use 0 for no limit (e.g. tests). Uses the same pooled Transport tuning as MLBClient
// (idle connections, header/TLS deadlines); no automatic retries (single GET per call).
func NewSavantClient(baseURL string, maxQPS float64) *SavantClient {
	reqTimeout := defaultSavantHTTPTimeout
	t := cloneUpstreamTransport(reqTimeout)
	c := &SavantClient{
		baseURL: strings.TrimRight(baseURL, "/"),
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
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "text/csv,*/*;q=0.8")
	req.Header.Set("User-Agent", savantUserAgent)

	if c.upstream != nil {
		if err := c.upstream.Wait(ctx); err != nil {
			return nil, err
		}
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("savant GET %s: status %d: %s", path, res.StatusCode, truncate(body, 200))
	}
	return body, nil
}
