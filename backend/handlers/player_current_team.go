package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

type mlbPersonHydratePayload struct {
	People []struct {
		ID          int64 `json:"id"`
		CurrentTeam *struct {
			ID int `json:"id"`
		} `json:"currentTeam"`
	} `json:"people"`
}

// PlayerCurrentTeam returns the player's current MLB team id (for chart colors), if any.
func (h *Handlers) PlayerCurrentTeam(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "playerID")
	id, err := strconv.ParseInt(strings.TrimSpace(idStr), 10, 64)
	if err != nil || id <= 0 {
		http.Error(w, "invalid player id", http.StatusBadRequest)
		return
	}

	cacheKey := "player-current-team:" + strconv.FormatInt(id, 10)
	if body, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
		return
	}

	path := "/people/" + strconv.FormatInt(id, 10) + "?hydrate=currentTeam"
	raw, err := h.mlb.Get(r.Context(), path)
	if err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	var payload mlbPersonHydratePayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		http.Error(w, "upstream parse error", http.StatusBadGateway)
		return
	}

	teamID := 0
	if len(payload.People) > 0 && payload.People[0].CurrentTeam != nil {
		teamID = payload.People[0].CurrentTeam.ID
	}

	out := models.PlayerCurrentTeamResponse{
		PlayerID: id,
		TeamID:   teamID,
	}

	body, err := json.Marshal(out)
	if err != nil {
		http.Error(w, "encode error", http.StatusInternalServerError)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLScores)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}
