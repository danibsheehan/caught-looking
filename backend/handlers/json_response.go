package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// writeJSONBytes sets Content-Type to application/json, Cache-Control from maxAge, and writes body
// (typically already JSON from cache or json.Marshal). maxAge should be the cache entry TTL or
// remaining TTL from GetOrLoad / GetOrLoadWithTTL.
func writeJSONBytes(w http.ResponseWriter, body []byte, maxAge time.Duration) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", cacheControlForTTL(maxAge))
	_, _ = w.Write(body)
}

// cacheControlLiveCeiling is the longest TTL treated as live/near-live for HTTP
// Cache-Control. At or below this, responses are max-age only. Above it (scores,
// standings, Statcast, etc.), browsers may serve stale while revalidating.
const cacheControlLiveCeiling = 60 * time.Second

// cacheControlForTTL maps in-process TTL to an HTTP Cache-Control value for anonymous GET JSON.
// Positive TTL → public max-age (floor seconds, minimum 1). Non-positive → private, no-store.
// Settled aggregates (TTL > cacheControlLiveCeiling) also get stale-while-revalidate
// and stale-if-error — see docs/adr/0001-cache-ttls.md.
func cacheControlForTTL(ttl time.Duration) string {
	if ttl <= 0 {
		return "private, no-store"
	}
	secs := int(ttl / time.Second)
	if secs < 1 {
		secs = 1
	}
	if ttl <= cacheControlLiveCeiling {
		return fmt.Sprintf("public, max-age=%d", secs)
	}
	swr := secs
	sie := secs * 2
	if sie > 86400 {
		sie = 86400
	}
	return fmt.Sprintf(
		"public, max-age=%d, stale-while-revalidate=%d, stale-if-error=%d",
		secs, swr, sie,
	)
}

// apiErrorBody is the standard JSON error envelope for API failures.
type apiErrorBody struct {
	Error string `json:"error"`
}

// respondAPIError writes {"error":"<message>"} with the given status.
func respondAPIError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(apiErrorBody{Error: message})
}

// errJSONEncode marks failures from marshalling a locally built response (not upstream).
var errJSONEncode = errors.New("json encode")

// errJSONDecode marks failures decoding our own cached/built JSON (not upstream MLB/Savant).
var errJSONDecode = errors.New("json decode")

// errUpstreamJSONParse marks json.Unmarshal failures on MLB/Savant response bodies.
var errUpstreamJSONParse = errors.New("upstream json parse")

func marshalCachedJSON(v any) ([]byte, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", errJSONEncode, err)
	}
	return b, nil
}

func wrapUpstreamJSONParse(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%w: %w", errUpstreamJSONParse, err)
}

func wrapJSONDecode(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%w: %w", errJSONDecode, err)
}

// respondGetOrLoadError maps GetOrLoad failures: encode/decode → 500, upstream JSON parse → 502
// with "upstream parse error", otherwise generic upstream handling.
func respondGetOrLoadError(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, errJSONEncode) {
		respondJSONEncodeError(w)
		return
	}
	if errors.Is(err, errJSONDecode) {
		respondAPIError(w, http.StatusInternalServerError, "internal parse error")
		return
	}
	if errors.Is(err, errUpstreamJSONParse) {
		respondUpstreamJSONParseError(w)
		return
	}
	respondUpstreamError(w, r, err)
}

func respondJSONEncodeError(w http.ResponseWriter) {
	respondAPIError(w, http.StatusInternalServerError, "encode error")
}

// respondUpstreamJSONParseError is for json.Unmarshal failures on upstream MLB/Savant JSON in handlers.
func respondUpstreamJSONParseError(w http.ResponseWriter) {
	respondAPIError(w, http.StatusBadGateway, "upstream parse error")
}
