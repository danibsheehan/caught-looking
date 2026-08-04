package models

// LeadersResponse is GET /leaders.
type LeadersResponse struct {
	Season     int         `json:"season"`
	Group      string      `json:"group"`
	Category   string      `json:"category"`
	Limit      int         `json:"limit"`
	Leaders    []LeaderRow `json:"leaders"`
	Categories []string    `json:"categories"`
}

// LeaderRow is one ranked player on a leaders board.
type LeaderRow struct {
	Rank       int    `json:"rank"`
	Value      string `json:"value"`
	PlayerID   int64  `json:"playerId"`
	PlayerName string `json:"playerName"`
	TeamID     int    `json:"teamId"`
	TeamName   string `json:"teamName"`
	LeagueName string `json:"leagueName,omitempty"`
}
