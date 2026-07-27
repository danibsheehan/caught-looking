package handlers

import (
	"encoding/json"
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

func respondJSONEncodeError(w http.ResponseWriter) {
	respondAPIError(w, http.StatusInternalServerError, "encode error")
}

// respondUpstreamJSONParseError is for json.Unmarshal failures on upstream MLB/Savant JSON in handlers.
func respondUpstreamJSONParseError(w http.ResponseWriter) {
	respondAPIError(w, http.StatusBadGateway, "upstream parse error")
}
