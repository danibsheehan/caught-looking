package models

// PlayerCurrentTeamResponse is one player element of GET /players/current-teams.
type PlayerCurrentTeamResponse struct {
	PlayerID int64 `json:"playerId"`
	TeamID   int   `json:"teamId"`
}
