package models

// RecordPoint is one completed game in chronological order for a club.
type RecordPoint struct {
	GameIndex    int     `json:"gameIndex"`
	OfficialDate string  `json:"officialDate"`
	Result       string  `json:"result"` // W, L, T
	Wins         int     `json:"wins"`
	Losses       int     `json:"losses"`
	Pct          float64 `json:"pct"`
}

// RecordTimelineResponse is GET /teams/{id}/record-timeline.
type RecordTimelineResponse struct {
	TeamID   int           `json:"teamId"`
	Season   int           `json:"season"`
	Points   []RecordPoint `json:"points"`
	Finished int           `json:"finishedGames"`
}
