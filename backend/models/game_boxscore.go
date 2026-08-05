package models

// GameBoxscoreResponse is GET /games/{gamePk}/boxscore.
type GameBoxscoreResponse struct {
	GamePk int64 `json:"gamePk"`
	// Status is the MLB display state (e.g. "In Progress", "Final"); empty when unknown.
	Status string      `json:"status,omitempty"`
	Away   TeamBoxSide `json:"away"`
	Home   TeamBoxSide `json:"home"`
}

// TeamBoxSide is one team's lines from the box score.
type TeamBoxSide struct {
	TeamID   int            `json:"teamId"`
	TeamName string         `json:"teamName"`
	Totals   TeamGameTotals `json:"totals"`
	Batting  []BatterLine   `json:"batting"`
	Pitching []PitcherLine  `json:"pitching"`
}

// TeamGameTotals is team-level batting/fielding for the game.
type TeamGameTotals struct {
	Runs       int `json:"runs"`
	Hits       int `json:"hits"`
	Errors     int `json:"errors"`
	LeftOnBase int `json:"leftOnBase,omitempty"`
	Doubles    int `json:"doubles,omitempty"`
	Triples    int `json:"triples,omitempty"`
	HomeRuns   int `json:"homeRuns,omitempty"`
}

// BatterLine is one player's batting line for the game.
type BatterLine struct {
	PlayerID int    `json:"playerId"`
	Name     string `json:"name"`
	Pos      string `json:"pos"`
	AB       int    `json:"ab"`
	R        int    `json:"r"`
	H        int    `json:"h"`
	Doubles  int    `json:"doubles"`
	Triples  int    `json:"triples"`
	HR       int    `json:"hr"`
	RBI      int    `json:"rbi"`
	BB       int    `json:"bb"`
	SO       int    `json:"so"`
}

// PitcherLine is one pitcher's line for the game.
type PitcherLine struct {
	PlayerID int    `json:"playerId"`
	Name     string `json:"name"`
	IP       string `json:"ip"`
	H        int    `json:"h"`
	R        int    `json:"r"`
	ER       int    `json:"er"`
	BB       int    `json:"bb"`
	SO       int    `json:"so"`
	HR       int    `json:"hr"`
}
