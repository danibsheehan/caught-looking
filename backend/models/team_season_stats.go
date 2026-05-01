package models

// TeamSeasonStatsResponse is the JSON for GET /teams/{id}/season-stats.
type TeamSeasonStatsResponse struct {
	Season      int              `json:"season"`
	TeamID      int              `json:"teamId"`
	Hitting     TeamHittingLine  `json:"hitting"`
	Pitching    TeamPitchingLine `json:"pitching"`
	VenueSplits TeamVenueSplits  `json:"venueSplits"`
}

// TeamVenueSplits is home vs road run environment and record from completed regular-season games
// (same /schedule feed as the record timeline; MLB team /stats does not expose homeAndAway splits).
type TeamVenueSplits struct {
	Home TeamVenueSplitLine `json:"home"`
	Away TeamVenueSplitLine `json:"away"`
}

// TeamVenueSplitLine aggregates one venue bucket for the club.
type TeamVenueSplitLine struct {
	Games              int     `json:"games"`
	Wins               int     `json:"wins"`
	Losses             int     `json:"losses"`
	RunsScored         int     `json:"runsScored"`
	RunsAllowed        int     `json:"runsAllowed"`
	RunsPerGame        float64 `json:"runsPerGame,omitempty"`
	RunsAllowedPerGame float64 `json:"runsAllowedPerGame,omitempty"`
}

// TeamHittingLine is aggregated team batting for the season.
type TeamHittingLine struct {
	GamesPlayed int     `json:"gamesPlayed"`
	Runs        int     `json:"runs"`
	RunsPerGame float64 `json:"runsPerGame"`
	Ops         float64 `json:"ops,omitempty"`
	Obp         float64 `json:"obp,omitempty"`
	Slg         float64 `json:"slg,omitempty"`
	Avg         float64 `json:"avg,omitempty"`
	// Counts and derived rates from the same MLB hitting split (statsapi field names).
	Doubles         int     `json:"doubles"`
	StolenBases     int     `json:"stolenBases"`
	HomeRuns        int     `json:"homeRuns,omitempty"`
	HomeRunsPerGame float64 `json:"homeRunsPerGame,omitempty"`
	IsolatedPower   float64 `json:"isolatedPower,omitempty"`
	BbPct           float64 `json:"bbPct,omitempty"`
	KPct            float64 `json:"kPct,omitempty"`
	Babip           float64 `json:"babip,omitempty"`
}

// TeamPitchingLine is aggregated team pitching for the season.
type TeamPitchingLine struct {
	GamesPlayed        int     `json:"gamesPlayed"`
	RunsAllowed        int     `json:"runsAllowed"`
	RunsAllowedPerGame float64 `json:"runsAllowedPerGame"`
	Era                float64 `json:"era,omitempty"`
	Whip               float64 `json:"whip,omitempty"`
	K9                 float64 `json:"k9,omitempty"`
	BB9                float64 `json:"bb9,omitempty"`
	Hr9                float64 `json:"hr9,omitempty"`
	H9                 float64 `json:"h9,omitempty"`
	Kbb                float64 `json:"kbb,omitempty"`
}
