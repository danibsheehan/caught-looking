package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/url"
	"strconv"
	"strings"

	"caught-looking/backend/models"
)

type venueScheduleGame struct {
	Status struct {
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

type venueSchedulePayload struct {
	Dates []struct {
		Games []venueScheduleGame `json:"games"`
	} `json:"dates"`
}

func parseVenueSplitsFromSchedule(raw []byte, teamID int) (models.TeamVenueSplits, error) {
	var payload venueSchedulePayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return models.TeamVenueSplits{}, err
	}

	var home, away models.TeamVenueSplitLine

	for _, d := range payload.Dates {
		for _, g := range d.Games {
			if !venueGameCountable(g) {
				continue
			}
			aid := g.Teams.Away.Team.ID
			hid := g.Teams.Home.Team.ID
			if aid != teamID && hid != teamID {
				continue
			}
			as := g.Teams.Away.Score
			hs := g.Teams.Home.Score
			if as == nil || hs == nil {
				continue
			}
			rs, ra, bucket := 0, 0, (*models.TeamVenueSplitLine)(nil)
			if hid == teamID {
				bucket = &home
				rs = *hs
				ra = *as
			} else {
				bucket = &away
				rs = *as
				ra = *hs
			}
			bucket.Games++
			bucket.RunsScored += rs
			bucket.RunsAllowed += ra
			if g.IsTie {
				continue
			}
			if hid == teamID {
				if g.Teams.Home.IsWinner {
					bucket.Wins++
				} else {
					bucket.Losses++
				}
			} else {
				if g.Teams.Away.IsWinner {
					bucket.Wins++
				} else {
					bucket.Losses++
				}
			}
		}
	}

	fillVenueRates(&home)
	fillVenueRates(&away)
	return models.TeamVenueSplits{Home: home, Away: away}, nil
}

func venueGameCountable(g venueScheduleGame) bool {
	if g.Status.AbstractGameState != "Final" {
		return false
	}
	ds := strings.ToLower(strings.TrimSpace(g.Status.DetailedState))
	if strings.Contains(ds, "postponed") || strings.Contains(ds, "cancelled") || strings.Contains(ds, "canceled") {
		return false
	}
	return true
}

func fillVenueRates(line *models.TeamVenueSplitLine) {
	if line.Games <= 0 {
		return
	}
	line.RunsPerGame = float64(line.RunsScored) / float64(line.Games)
	line.RunsAllowedPerGame = float64(line.RunsAllowed) / float64(line.Games)
}

func (h *Handlers) fetchTeamVenueSplitsFromSchedule(ctx context.Context, teamID, season int) (models.TeamVenueSplits, error) {
	q := url.Values{}
	q.Set("sportId", "1")
	q.Set("season", strconv.Itoa(season))
	q.Set("teamId", strconv.Itoa(teamID))
	q.Set("gameType", "R")
	path := "/schedule?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return models.TeamVenueSplits{}, err
	}
	return parseVenueSplitsFromSchedule(raw, teamID)
}

func (h *Handlers) fetchTeamVenueSplitsBestEffort(ctx context.Context, teamID, season int) models.TeamVenueSplits {
	out, err := h.fetchTeamVenueSplitsFromSchedule(ctx, teamID, season)
	if err != nil {
		log.Printf("team season stats: venue splits schedule: %v", err)
		return models.TeamVenueSplits{}
	}
	return out
}
