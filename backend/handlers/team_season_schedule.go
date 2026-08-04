package handlers

import (
	"context"
	"encoding/json"
	"net/url"
	"strconv"
	"time"
)

// fetchTeamSeasonSchedule returns the MLB regular-season schedule JSON for a team+season,
// cached so record timeline and venue splits share one upstream download.
// JSON is validated before caching so a corrupt payload is not sticky for the TTL.
func (h *Handlers) fetchTeamSeasonSchedule(ctx context.Context, teamID, season int) ([]byte, error) {
	key := "team-season-schedule:" + strconv.Itoa(teamID) + ":" + strconv.Itoa(season)
	ttl := cacheTTLForSeason(season, h.cfg, time.Now())
	body, _, err := h.cache.GetOrLoad(ctx, key, ttl, func(ctx context.Context) ([]byte, error) {
		q := url.Values{}
		q.Set("sportId", "1")
		q.Set("season", strconv.Itoa(season))
		q.Set("teamId", strconv.Itoa(teamID))
		q.Set("gameType", "R")
		body, err := h.mlb.Get(ctx, "/schedule?"+q.Encode())
		if err != nil {
			return nil, err
		}
		var payload mlbSchedulePayload
		if err := json.Unmarshal(body, &payload); err != nil {
			return nil, wrapUpstreamJSONParse(err)
		}
		return body, nil
	})
	return body, err
}
