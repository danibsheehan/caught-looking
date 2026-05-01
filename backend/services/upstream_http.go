package services

import (
	"net/http"
	"time"
)

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
