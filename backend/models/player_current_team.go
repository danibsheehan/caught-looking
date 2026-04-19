package models

// PlayerCurrentTeamResponse is GET /players/{id}/current-team.
type PlayerCurrentTeamResponse struct {
	PlayerID int64 `json:"playerId"`
	TeamID   int   `json:"teamId"`
}
