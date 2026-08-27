package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"
)

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
func (h *Handlers) playerCurrentTeamJSON(ctx context.Context, id int64) ([]byte, time.Duration, error) {
	cacheKey := "player-current-team:" + strconv.FormatInt(id, 10)
	return h.cache.GetOrLoad(ctx, cacheKey, h.cfg.TTLScores, func(ctx context.Context) ([]byte, error) {
		path := "/people/" + strconv.FormatInt(id, 10) + "?hydrate=currentTeam"
		raw, err := h.mlb.Get(ctx, path)
		if err != nil {
			return nil, err
		}

		var payload mlbPersonHydratePayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			return nil, wrapUpstreamJSONParse(err)
		}

		teamID := 0
		if len(payload.People) > 0 && payload.People[0].CurrentTeam != nil {
			teamID = payload.People[0].CurrentTeam.ID
		}

		out := models.PlayerCurrentTeamResponse{
			PlayerID: id,
			TeamID:   teamID,
		}
		return marshalCachedJSON(out)
	})
}

// PlayerCurrentTeam returns the player's current MLB team id (for chart colors), if any.
func (h *Handlers) PlayerCurrentTeam(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "playerID")
	id, err := strconv.ParseInt(strings.TrimSpace(idStr), 10, 64)
	if err != nil || id <= 0 {
		respondAPIError(w, http.StatusBadRequest, "invalid player id")
		return
	}

	body, ttl, err := h.playerCurrentTeamJSON(r.Context(), id)
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body, ttl)
}

// PlayersCurrentTeams returns current team ids for two players in one round trip (same cache keys as single-player GET).
func (h *Handlers) PlayersCurrentTeams(w http.ResponseWriter, r *http.Request) {
	id1, id2, err := parseTwoPlayerIDs(r.URL.Query().Get("ids"))
	if err != nil {
		respondTwoPlayerIDsError(w, err, "invalid ids (need two distinct positive player ids)")
		return
	}
	if id1 == id2 {
		respondAPIError(w, http.StatusBadRequest, "invalid ids (need two distinct positive player ids)")
		return
	}

	ctx := r.Context()
	g, gctx := errgroup.WithContext(ctx)
	var b1, b2 []byte
	var ttl1, ttl2 time.Duration
	g.Go(func() error {
		var err error
		b1, ttl1, err = h.playerCurrentTeamJSON(gctx, id1)
		return err
	})
	g.Go(func() error {
		var err error
		b2, ttl2, err = h.playerCurrentTeamJSON(gctx, id2)
		return err
	})
	if err := g.Wait(); err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}

	var p1, p2 models.PlayerCurrentTeamResponse
	if err := json.Unmarshal(b1, &p1); err != nil {
		respondAPIError(w, http.StatusInternalServerError, "internal cache decode error")
		return
	}
	if err := json.Unmarshal(b2, &p2); err != nil {
		respondAPIError(w, http.StatusInternalServerError, "internal cache decode error")
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
	ttl := ttl1
	if ttl2 < ttl {
		ttl = ttl2
	}
	writeJSONBytes(w, body, ttl)
}
