package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"caught-looking/backend/models"
)

type mlbTeamsPayload struct {
	Teams []struct {
		ID           int    `json:"id"`
		Name         string `json:"name"`
		Abbreviation string `json:"abbreviation"`
		TeamName     string `json:"teamName"`
		Active       bool   `json:"active"`
		League       struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
		} `json:"league"`
		Division struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
		} `json:"division"`
	} `json:"teams"`
}

// Teams proxies MLB /teams with caching and a slimmer JSON shape.
func (h *Handlers) Teams(w http.ResponseWriter, r *http.Request) {
	sportID := r.URL.Query().Get("sportId")
	if sportID == "" {
		sportID = "1"
	}
	if _, err := strconv.Atoi(sportID); err != nil {
		respondAPIError(w, http.StatusBadRequest, "invalid sportId")
		return
	}

	cacheKey := "teams:" + sportID
	body, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLStandings, func(ctx context.Context) ([]byte, error) {
		path := "/teams?sportId=" + sportID
		raw, err := h.mlb.Get(ctx, path)
		if err != nil {
			return nil, err
		}

		var payload mlbTeamsPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			return nil, fmt.Errorf("teams parse: %w", err)
		}

		teams := make([]models.Team, 0, len(payload.Teams))
		for _, t := range payload.Teams {
			teams = append(teams, models.Team{
				ID:           t.ID,
				Name:         t.Name,
				Abbreviation: t.Abbreviation,
				TeamName:     t.TeamName,
				LeagueID:     t.League.ID,
				LeagueName:   t.League.Name,
				DivisionID:   t.Division.ID,
				DivisionName: t.Division.Name,
				Active:       t.Active,
			})
		}

		return marshalCachedJSON(models.TeamsResponse{Teams: teams})
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body)
}
