package models

// StandingTeam is one club's row within a division in the regular season.
type StandingTeam struct {
	TeamID        int    `json:"teamId"`
	TeamName      string `json:"teamName"`
	Wins          int    `json:"wins"`
	Losses        int    `json:"losses"`
	Pct           string `json:"pct"`
	GamesPlayed   int    `json:"gamesPlayed"`
	DivisionRank  string `json:"divisionRank"`
	GamesBack     string `json:"gamesBack"`
	WildCardGames string `json:"wildCardGamesBack,omitempty"`
}

// StandingDivision groups teams under one division label.
type StandingDivision struct {
	DivisionID   int            `json:"divisionId"`
	DivisionName string         `json:"divisionName"`
	LeagueID     int            `json:"leagueId"`
	Teams        []StandingTeam `json:"teams"`
}

// StandingsResponse is the JSON envelope for GET /standings.
type StandingsResponse struct {
	Season    int                `json:"season"`
	Divisions []StandingDivision `json:"divisions"`
}
