package models

// GameStatcastPitchesResponse is GET /games/{gamePk}/statcast/pitches (Statcast pitch rows from Savant CSV).
type GameStatcastPitchesResponse struct {
	GamePk  int64           `json:"gamePk"`
	Pitches []StatcastPitch `json:"pitches"`
}

// StatcastPitch is one pitch with plate location (Savant `plate_x` / `plate_z`, feet) and classification.
type StatcastPitch struct {
	PlateX       float64  `json:"plateX"`
	PlateZ       float64  `json:"plateZ"`
	PitchName    string   `json:"pitchName,omitempty"`
	Pitcher      int      `json:"pitcher"`
	ReleaseSpeed *float64 `json:"releaseSpeed,omitempty"`
	InningHalf   string   `json:"inningHalf,omitempty"`
	// SzTop/SzBot are the top and bottom of the batter’s strike zone (feet), Savant `sz_top` / `sz_bot`.
	SzTop *float64 `json:"szTop,omitempty"`
	SzBot *float64 `json:"szBot,omitempty"`
	// BatterStand is Savant `stand`: L, R, or S (switch); empty when missing.
	BatterStand string `json:"batterStand,omitempty"`
}
