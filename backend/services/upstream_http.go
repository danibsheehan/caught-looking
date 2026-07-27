package services

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// maxUpstreamBodyBytes caps MLB/Savant response bodies to bound memory use.
const maxUpstreamBodyBytes = 32 << 20 // 32 MiB

const maxRetryAfter = 5 * time.Second

func readBodyLimited(r io.Reader, max int64) ([]byte, error) {
	if max <= 0 {
		max = maxUpstreamBodyBytes
	}
	body, err := io.ReadAll(io.LimitReader(r, max+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > max {
		return nil, fmt.Errorf("upstream response exceeds %d bytes", max)
	}
	return body, nil
}

func upstreamStatusRetryable(code int) bool {
	return code == http.StatusTooManyRequests || code == http.StatusServiceUnavailable
}

// retryAfterDelay returns how long to wait before retrying a 429/503, preferring Retry-After
// (seconds or HTTP-date) and capping at maxRetryAfter.
func retryAfterDelay(res *http.Response, attempt int) time.Duration {
	fallback := time.Duration(100*attempt) * time.Millisecond
	if res == nil {
		return fallback
	}
	ra := res.Header.Get("Retry-After")
	if ra == "" {
		return fallback
	}
	if secs, err := strconv.Atoi(ra); err == nil {
		if secs < 0 {
			secs = 0
		}
		d := time.Duration(secs) * time.Second
		if d > maxRetryAfter {
			return maxRetryAfter
		}
		return d
	}
	if t, err := http.ParseTime(ra); err == nil {
		d := time.Until(t)
		if d < 0 {
			d = 0
		}
		if d > maxRetryAfter {
			return maxRetryAfter
		}
		return d
	}
	return fallback
}

// cloneUpstreamTransport returns a DefaultTransport clone tuned for keep-alive to one upstream host
// (MLB Stats API, Savant CSV, etc.): idle pool limits, header deadline, TLS handshake cap.
func cloneUpstreamTransport(clientTimeout time.Duration) *http.Transport {
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.MaxIdleConns = 100
	t.MaxIdleConnsPerHost = 32
	t.IdleConnTimeout = 60 * time.Second
	t.ResponseHeaderTimeout = upstreamResponseHeaderTimeout(clientTimeout)
	t.TLSHandshakeTimeout = 10 * time.Second
	t.ExpectContinueTimeout = 1 * time.Second
	return t
}

// upstreamResponseHeaderTimeout mirrors MLB client behavior: sub-deadline for response headers
// relative to the overall http.Client.Timeout.
func upstreamResponseHeaderTimeout(clientTimeout time.Duration) time.Duration {
	if clientTimeout <= 5*time.Second {
		if clientTimeout <= 2*time.Second {
			return clientTimeout / 2
		}
		return clientTimeout - time.Second
	}
	ht := clientTimeout * 2 / 3
	if ht < 5*time.Second {
		return 5 * time.Second
	}
	return ht
}
