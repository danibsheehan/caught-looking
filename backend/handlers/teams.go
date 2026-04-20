package handlers

import (
	"encoding/json"
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
		http.Error(w, "invalid sportId", http.StatusBadRequest)
		return
	}

	cacheKey := "teams:" + sportID
	if body, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
		return
	}

	path := "/teams?sportId=" + sportID
	raw, err := h.mlb.Get(r.Context(), path)
	if err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	var payload mlbTeamsPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		http.Error(w, "upstream parse error", http.StatusBadGateway)
		return
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

	body, err := json.Marshal(models.TeamsResponse{Teams: teams})
	if err != nil {
		http.Error(w, "encode error", http.StatusInternalServerError)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLStandings)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}
