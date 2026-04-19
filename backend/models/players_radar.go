package models

// PlayerStatSnapshot is a normalized slice of stats for charting.
type PlayerStatSnapshot struct {
	ID       int64              `json:"id"`
	FullName string             `json:"fullName"`
	Group    string             `json:"group"` // hitting | pitching
	Stats    map[string]float64 `json:"stats"` // hitting & pitching season fields; see players_compare handler
}

// PlayersRadarResponse is GET /players/compare.
type PlayersRadarResponse struct {
	Scope   string               `json:"scope"` // season | career
	Season  int                  `json:"season"` // set when scope=season; 0 when career
	Group   string               `json:"group"`
	Players []PlayerStatSnapshot `json:"players"`
}
