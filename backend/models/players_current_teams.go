package models

// PlayersCurrentTeamsResponse is GET /players/current-teams (two players, same order as ids query).
type PlayersCurrentTeamsResponse struct {
	Players []PlayerCurrentTeamResponse `json:"players"`
}
