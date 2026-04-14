package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const mlbUserAgent = "caught-looking/0.1 (+https://github.com) statsapi client"

// MLBClient performs GET requests against statsapi.mlb.com (or a compatible base URL).
type MLBClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewMLBClient(baseURL string) *MLBClient {
	return &MLBClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
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
