package handlers

import "net/http"

// writeJSONBytes sets Content-Type to application/json and writes body (typically already JSON from cache or json.Marshal).
func writeJSONBytes(w http.ResponseWriter, body []byte) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

func respondJSONEncodeError(w http.ResponseWriter) {
	http.Error(w, "encode error", http.StatusInternalServerError)
}

// respondUpstreamJSONParseError is for json.Unmarshal failures on upstream MLB/Savant JSON in handlers.
func respondUpstreamJSONParseError(w http.ResponseWriter) {
	http.Error(w, "upstream parse error", http.StatusBadGateway)
}
