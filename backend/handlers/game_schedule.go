package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

// fetchGameScheduleRaw returns MLB /schedule?gamePks={pk} JSON for one game, cached so the
// boxscore (status) and Statcast (venue) handlers share a single upstream download per gamePk.
// JSON is validated before caching so a corrupt payload is not sticky for the TTL.
func (h *Handlers) fetchGameScheduleRaw(ctx context.Context, pkStr string) ([]byte, error) {
	key := "mlb-game-schedule-raw:" + pkStr
	body, _, err := h.cache.GetOrLoadWithTTL(ctx, key, func(ctx context.Context) ([]byte, time.Duration, error) {
		raw, err := h.mlb.Get(ctx, "/schedule?sportId=1&gamePks="+pkStr)
		if err != nil {
			return nil, 0, err
		}
		if !json.Valid(raw) {
			return nil, 0, wrapUpstreamJSONParse(errors.New("invalid schedule JSON"))
		}
		status := scheduleGameDisplayStatus(raw)
		return raw, cacheTTLForGameStatus(status, h.cfg), nil
	})
	return body, err
}
