package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
)

// writeJSONBytes sets Content-Type to application/json and writes body (typically already JSON from cache or json.Marshal).
func writeJSONBytes(w http.ResponseWriter, body []byte) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
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
