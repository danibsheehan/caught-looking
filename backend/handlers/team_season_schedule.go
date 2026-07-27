package handlers

import (
	"context"
	"net/url"
	"strconv"
)

// fetchTeamSeasonSchedule returns the MLB regular-season schedule JSON for a team+season,
// cached so record timeline and venue splits share one upstream download.
func (h *Handlers) fetchTeamSeasonSchedule(ctx context.Context, teamID, season int) ([]byte, error) {
	key := "team-season-schedule:" + strconv.Itoa(teamID) + ":" + strconv.Itoa(season)
	return h.cache.GetOrLoad(ctx, key, h.cfg.TTLScores, func(ctx context.Context) ([]byte, error) {
		q := url.Values{}
		q.Set("sportId", "1")
		q.Set("season", strconv.Itoa(season))
		q.Set("teamId", strconv.Itoa(teamID))
		q.Set("gameType", "R")
		return h.mlb.Get(ctx, "/schedule?"+q.Encode())
	})
}
