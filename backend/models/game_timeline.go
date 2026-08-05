package models

// InningScore is runs scored in one half-line (both sides).
type InningScore struct {
	Inning   int `json:"inning"`
	HomeRuns int `json:"homeRuns"`
	AwayRuns int `json:"awayRuns"`
}

// GameTimelineResponse is GET /games/{gamePk}/timeline.
type GameTimelineResponse struct {
	GamePk int64 `json:"gamePk"`
	// Status is the MLB display state (e.g. "In Progress", "Final"); empty when unknown.
	Status    string        `json:"status,omitempty"`
	HomeTeam  string        `json:"homeTeam"`
	AwayTeam  string        `json:"awayTeam"`
	HomeID    int           `json:"homeId"`
	AwayID    int           `json:"awayId"`
	Innings   []InningScore `json:"innings"`
	HomeTotal int           `json:"homeTotal"`
	AwayTotal int           `json:"awayTotal"`
}
