package models

// PlayerStatSnapshot is a normalized slice of stats for charting.
type PlayerStatSnapshot struct {
	ID       int64              `json:"id"`
	FullName string             `json:"fullName"`
	Group    string             `json:"group"` // hitting | pitching
	Stats    map[string]float64 `json:"stats"` // keys: avg, obp, slg, hr, rbi OR era, whip, k9, bb9
}

// PlayersRadarResponse is GET /players/compare.
type PlayersRadarResponse struct {
	Season  int                  `json:"season"`
	Group   string               `json:"group"`
	Players []PlayerStatSnapshot `json:"players"`
}
