package models

// GameSummary is one game on a calendar day for UI selection.
type GameSummary struct {
	GamePk       int64  `json:"gamePk"`
	AwayTeam     string `json:"awayTeam"`
	HomeTeam     string `json:"homeTeam"`
	AwayID       int    `json:"awayId"`
	HomeID       int    `json:"homeId"`
	Status    string `json:"status"`
	AwayScore int    `json:"awayScore"`
	HomeScore int    `json:"homeScore"`
	OfficialDate string `json:"officialDate,omitempty"`
}

// GamesForDateResponse is GET /games/for-date.
type GamesForDateResponse struct {
	Date  string        `json:"date"`
	Games []GameSummary `json:"games"`
}
