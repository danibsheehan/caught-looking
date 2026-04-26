package models

// LeagueSeasonBaselineResponse is GET /league/season-baseline.
type LeagueSeasonBaselineResponse struct {
	Season int     `json:"season"`
	Group  string  `json:"group"`
	Ops    float64 `json:"ops,omitempty"`
	Era    float64 `json:"era,omitempty"`
}

// PlayersYearByYearResponse is GET /players/compare/year-by-year.
type PlayersYearByYearResponse struct {
	Group          string             `json:"group"`
	Metric         string             `json:"metric"` // hitting: ops|avg|obp|slg|woba — pitching: era|whip|k9|bb9|fip
	Players        []YearSeriesPlayer `json:"players"`
	LeagueBySeason map[string]float64 `json:"leagueBySeason"`
}

type YearSeriesPlayer struct {
	ID       int64         `json:"id"`
	FullName string        `json:"fullName"`
	Points   []SeasonPoint `json:"points"`
}

type SeasonPoint struct {
	Season int     `json:"season"`
	Value  float64 `json:"value"`
}

// PlayersGameLogResponse is GET /players/compare/game-log.
type PlayersGameLogResponse struct {
	Season         int               `json:"season"`
	Group          string            `json:"group"`
	Metric         string            `json:"metric"` // ops | era
	Limit          int               `json:"limit"`
	Players        []GameLogPlayer   `json:"players"`
	LeagueBaseline float64           `json:"leagueBaseline"`
}

type GameLogPlayer struct {
	ID       int64       `json:"id"`
	FullName string      `json:"fullName"`
	Games    []GamePoint `json:"games"`
}

type GamePoint struct {
	Date   string  `json:"date"`
	GamePk int64   `json:"gamePk"`
	Value  float64 `json:"value"`
}

// PlatoonSplitRow is one MLB statSplits bucket (sitCodes vl or vr).
type PlatoonSplitRow struct {
	Code        string  `json:"code"`
	Description string  `json:"description"`
	Ops         float64 `json:"ops"`
	Sample      int     `json:"sample"`
}

// PlatoonPlayer is one player’s vl/vr rows for GET /players/compare/platoon.
type PlatoonPlayer struct {
	ID       int64             `json:"id"`
	FullName string            `json:"fullName"`
	Splits   []PlatoonSplitRow `json:"splits"`
}

// PlayersPlatoonResponse is GET /players/compare/platoon.
type PlayersPlatoonResponse struct {
	Season  int             `json:"season"`
	Group   string          `json:"group"`
	Metric  string          `json:"metric"`
	Players []PlatoonPlayer `json:"players"`
}
