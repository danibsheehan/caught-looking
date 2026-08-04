package handlers

import (
	"context"
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
	body, ttl, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLPlayerSearch, func(ctx context.Context) ([]byte, error) {
		qs := url.Values{}
		qs.Set("names", q)
		path := "/people/search?" + qs.Encode()

		raw, err := h.mlb.Get(ctx, path)
		if err != nil {
			return nil, err
		}

		var payload mlbPeopleSearchPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			return nil, wrapUpstreamJSONParse(err)
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
		return marshalCachedJSON(out)
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}

	var cached models.PlayersSearchResponse
	if err := json.Unmarshal(body, &cached); err == nil {
		w.Header().Set("X-Result-Count", strconv.Itoa(len(cached.People)))
	}
	writeJSONBytes(w, body, ttl)
}
