package models

// GameStatcastResponse is GET /games/{gamePk}/statcast (Statcast pitch rows from Baseball Savant CSV).
type GameStatcastResponse struct {
	GamePk      int64                `json:"gamePk"`
	VenueID     int                  `json:"venueId,omitempty"`
	VenueName   string               `json:"venueName,omitempty"`
	BattedBalls []StatcastBattedBall `json:"battedBalls"`
}

// StatcastBattedBall is one ball-in-play row with launch metrics (subset of Savant CSV columns).
type StatcastBattedBall struct {
	LaunchSpeed *float64 `json:"launchSpeed,omitempty"`
	LaunchAngle *float64 `json:"launchAngle,omitempty"`
	// HCX/HCY are Statcast Search grid coordinates (hc_x / hc_y); consumers map to field feet for spray plots.
	HCX *float64 `json:"hcX,omitempty"`
	HCY *float64 `json:"hcY,omitempty"`
	Batter      int      `json:"batter"`
	Pitcher     int      `json:"pitcher"`
	PlayerName  string   `json:"playerName"`
	Events      string   `json:"events,omitempty"`
	InningHalf  string   `json:"inningHalf,omitempty"` // "Top" or "Bottom" (Savant CSV uses "Bot")
}
