package models

// TeamSeasonStatsResponse is the JSON for GET /teams/{id}/season-stats.
type TeamSeasonStatsResponse struct {
	Season   int              `json:"season"`
	TeamID   int              `json:"teamId"`
	Hitting  TeamHittingLine  `json:"hitting"`
	Pitching TeamPitchingLine `json:"pitching"`
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
}
