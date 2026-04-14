package models

// Team is a stable, frontend-friendly row for MLB clubs.
type Team struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Abbreviation string `json:"abbreviation"`
	TeamName     string `json:"teamName"`
	LeagueID     int    `json:"leagueId"`
	LeagueName   string `json:"leagueName"`
	DivisionID   int    `json:"divisionId"`
	DivisionName string `json:"divisionName"`
	Active       bool   `json:"active"`
}

// TeamsResponse is the JSON envelope for GET /teams.
type TeamsResponse struct {
	Teams []Team `json:"teams"`
}
