package handlers

import "strings"

// mlbScheduleGame is the shared MLB schedule game shape used by record timeline and venue splits.
type mlbScheduleGame struct {
	OfficialDate string `json:"officialDate"`
	GameDate     string `json:"gameDate"`
	Status       struct {
		AbstractGameState string `json:"abstractGameState"`
		DetailedState     string `json:"detailedState"`
	} `json:"status"`
	IsTie bool `json:"isTie"`
	Teams struct {
		Away struct {
			Team struct {
				ID int `json:"id"`
			} `json:"team"`
			IsWinner bool `json:"isWinner"`
			Score    *int `json:"score"`
		} `json:"away"`
		Home struct {
			Team struct {
				ID int `json:"id"`
			} `json:"team"`
			IsWinner bool `json:"isWinner"`
			Score    *int `json:"score"`
		} `json:"home"`
	} `json:"teams"`
}

type mlbSchedulePayload struct {
	Dates []struct {
		Games []mlbScheduleGame `json:"games"`
	} `json:"dates"`
}

// scheduleGameFinalPlayed is true for completed games that are not postponed/cancelled placeholders.
func scheduleGameFinalPlayed(g mlbScheduleGame) bool {
	if g.Status.AbstractGameState != "Final" {
		return false
	}
	ds := strings.ToLower(strings.TrimSpace(g.Status.DetailedState))
	if strings.Contains(ds, "postponed") || strings.Contains(ds, "cancelled") || strings.Contains(ds, "canceled") {
		return false
	}
	return true
}

// timelineGameCountable excludes live/preview games and MLB "Final" placeholders
// that are postponed/cancelled (no winner) — those were previously counted as losses.
func timelineGameCountable(g mlbScheduleGame) bool {
	if !scheduleGameFinalPlayed(g) {
		return false
	}
	if g.IsTie {
		return true
	}
	return g.Teams.Away.IsWinner || g.Teams.Home.IsWinner
}

func venueGameCountable(g mlbScheduleGame) bool {
	return scheduleGameFinalPlayed(g)
}
