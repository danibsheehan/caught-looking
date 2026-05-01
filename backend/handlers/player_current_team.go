package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"
)

// errMLBPeopleUnmarshal marks failure to decode MLB /people hydrate JSON inside playerCurrentTeamJSON.
var errMLBPeopleUnmarshal = errors.New("mlb people json unmarshal")

type mlbPersonHydratePayload struct {
	People []struct {
		ID          int64 `json:"id"`
		CurrentTeam *struct {
			ID int `json:"id"`
		} `json:"currentTeam"`
	} `json:"people"`
}

// playerCurrentTeamJSON returns cached or freshly fetched JSON for one player
// (same payload as GET /players/{id}/current-team).
func (h *Handlers) playerCurrentTeamJSON(ctx context.Context, id int64) ([]byte, error) {
	cacheKey := "player-current-team:" + strconv.FormatInt(id, 10)
	if body, ok := h.cache.Get(cacheKey); ok {
		return body, nil
	}

	path := "/people/" + strconv.FormatInt(id, 10) + "?hydrate=currentTeam"
	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return nil, err
	}

	var payload mlbPersonHydratePayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, errors.Join(errMLBPeopleUnmarshal, err)
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
		return nil, err
	}
	h.cache.Set(cacheKey, body, h.cfg.TTLScores)
	return body, nil
}

// PlayerCurrentTeam returns the player's current MLB team id (for chart colors), if any.
func (h *Handlers) PlayerCurrentTeam(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "playerID")
	id, err := strconv.ParseInt(strings.TrimSpace(idStr), 10, 64)
	if err != nil || id <= 0 {
		http.Error(w, "invalid player id", http.StatusBadRequest)
		return
	}

	body, err := h.playerCurrentTeamJSON(r.Context(), id)
	if err != nil {
		if errors.Is(err, errMLBPeopleUnmarshal) {
			respondUpstreamJSONParseError(w)
			return
		}
		respondUpstreamError(w, r, err)
		return
	}
	writeJSONBytes(w, body)
}

// PlayersCurrentTeams returns current team ids for two players in one round trip (same cache keys as single-player GET).
func (h *Handlers) PlayersCurrentTeams(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("ids"))
	parts := strings.Split(raw, ",")
	if len(parts) != 2 {
		http.Error(w, "query ids must be two comma-separated MLB person ids", http.StatusBadRequest)
		return
	}
	id1, err1 := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 64)
	id2, err2 := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
	if err1 != nil || err2 != nil || id1 <= 0 || id2 <= 0 || id1 == id2 {
		http.Error(w, "invalid ids (need two distinct positive player ids)", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	g, gctx := errgroup.WithContext(ctx)
	var b1, b2 []byte
	g.Go(func() error {
		var err error
		b1, err = h.playerCurrentTeamJSON(gctx, id1)
		return err
	})
	g.Go(func() error {
		var err error
		b2, err = h.playerCurrentTeamJSON(gctx, id2)
		return err
	})
	if err := g.Wait(); err != nil {
		if errors.Is(err, errMLBPeopleUnmarshal) {
			respondUpstreamJSONParseError(w)
			return
		}
		respondUpstreamError(w, r, err)
		return
	}

	var p1, p2 models.PlayerCurrentTeamResponse
	if err := json.Unmarshal(b1, &p1); err != nil {
		http.Error(w, "internal cache decode error", http.StatusInternalServerError)
		return
	}
	if err := json.Unmarshal(b2, &p2); err != nil {
		http.Error(w, "internal cache decode error", http.StatusInternalServerError)
		return
	}

	out := models.PlayersCurrentTeamsResponse{
		Players: []models.PlayerCurrentTeamResponse{p1, p2},
	}
	body, err := json.Marshal(out)
	if err != nil {
		respondJSONEncodeError(w)
		return
	}
	writeJSONBytes(w, body)
}
