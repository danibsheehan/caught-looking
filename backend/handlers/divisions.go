package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

const divisionNamesCacheKey = "divisions:sportId:1"
const divisionNamesTTL = 24 * time.Hour

type mlbDivisionsPayload struct {
	Divisions []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"divisions"`
}

type divisionNameRow struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// loadDivisionNames returns division id → display name, backed by a long-lived cache entry.
func (h *Handlers) loadDivisionNames(ctx context.Context) (map[int]string, error) {
	body, err := h.cache.GetOrLoad(ctx, divisionNamesCacheKey, divisionNamesTTL, func(ctx context.Context) ([]byte, error) {
		raw, err := h.mlb.Get(ctx, "/divisions?sportId=1")
		if err != nil {
			return nil, err
		}

		var payload mlbDivisionsPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			return nil, wrapUpstreamJSONParse(err)
		}

		rows := make([]divisionNameRow, 0, len(payload.Divisions))
		for _, d := range payload.Divisions {
			rows = append(rows, divisionNameRow{ID: d.ID, Name: d.Name})
		}
		return marshalCachedJSON(rows)
	})
	if err != nil {
		return nil, err
	}

	var rows []divisionNameRow
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, fmt.Errorf("%w: %w", errJSONDecode, err)
	}
	out := make(map[int]string, len(rows))
	for _, r := range rows {
		out[r.ID] = r.Name
	}
	return out, nil
}
