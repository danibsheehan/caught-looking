package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"caught-looking/backend/models"
)

type mlbPeopleSearchPayload struct {
	People []struct {
		ID              int64  `json:"id"`
		FullName        string `json:"fullName"`
		Active          bool   `json:"active"`
		PrimaryNumber   string `json:"primaryNumber"`
		PrimaryPosition struct {
			Abbreviation string `json:"abbreviation"`
		} `json:"primaryPosition"`
	} `json:"people"`
}

// PlayerSearch proxies MLB /people/search for name-based discovery.
func (h *Handlers) PlayerSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("names"))
	if q == "" {
		q = strings.TrimSpace(r.URL.Query().Get("q"))
	}
	if len(q) < 2 {
		respondAPIError(w, http.StatusBadRequest, "query must be at least 2 characters (names or q)")
		return
	}
	if len(q) > 64 {
		respondAPIError(w, http.StatusBadRequest, "query too long")
		return
	}

	const maxHits = 15
	cacheKey := "player-search:" + strings.ToLower(q)
	if body, ok := h.cache.Get(cacheKey); ok {
		writeJSONBytes(w, body)
		return
	}

	qs := url.Values{}
	qs.Set("names", q)
	path := "/people/search?" + qs.Encode()

	raw, err := h.mlb.Get(r.Context(), path)
	if err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	var payload mlbPeopleSearchPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		respondUpstreamJSONParseError(w)
		return
	}

	truncated := len(payload.People) > maxHits
	people := payload.People
	if len(people) > maxHits {
		people = people[:maxHits]
	}

	out := models.PlayersSearchResponse{
		Query:     q,
		Truncated: truncated,
		People:    make([]models.PlayerSearchHit, 0, len(people)),
	}
	for _, p := range people {
		out.People = append(out.People, models.PlayerSearchHit{
			ID:         p.ID,
			FullName:   p.FullName,
			Position:   p.PrimaryPosition.Abbreviation,
			Active:     p.Active,
			PrimaryNum: p.PrimaryNumber,
		})
	}

	body, err := json.Marshal(out)
	if err != nil {
		respondJSONEncodeError(w)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLPlayerSearch)
	w.Header().Set("X-Result-Count", strconv.Itoa(len(out.People)))
	writeJSONBytes(w, body)
}
