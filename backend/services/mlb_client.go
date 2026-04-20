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

const mlbUserAgent = "caught-looking/0.1 (+https://github.com) statsapi client"

// MLBClient performs GET requests against statsapi.mlb.com (or a compatible base URL).
type MLBClient struct {
	baseURL    string
	httpClient *http.Client
	upstream   *rate.Limiter
}

// NewMLBClient returns a client for the given base URL. maxQPS caps outbound GET rate per process
// (token bucket); use 0 for no limit (e.g. tests).
func NewMLBClient(baseURL string, maxQPS float64) *MLBClient {
	c := &MLBClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
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
	if path == "" || path[0] != '/' {
		return nil, fmt.Errorf("mlb path must start with /, got %q", path)
	}
	u := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", mlbUserAgent)

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
		return nil, fmt.Errorf("mlb GET %s: status %d: %s", path, res.StatusCode, truncate(body, 200))
	}
	return body, nil
}

func truncate(b []byte, n int) string {
	s := string(b)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
