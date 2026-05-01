package models

// PlayerSearchHit is one row from MLB people search.
type PlayerSearchHit struct {
	ID         int64  `json:"id"`
	FullName   string `json:"fullName"`
	Position   string `json:"position,omitempty"`
	Active     bool   `json:"active"`
	PrimaryNum string `json:"primaryNumber,omitempty"`
}

// PlayersSearchResponse is GET /players/search.
type PlayersSearchResponse struct {
	Query     string            `json:"query"`
	People    []PlayerSearchHit `json:"people"`
	Truncated bool              `json:"truncated,omitempty"`
}
