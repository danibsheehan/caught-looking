package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

type scheduleGame struct {
	OfficialDate string `json:"officialDate"`
	GameDate     string `json:"gameDate"`
	Status       struct {
		AbstractGameState string `json:"abstractGameState"`
	} `json:"status"`
	IsTie bool `json:"isTie"`
	Teams struct {
		Away struct {
			Team struct {
				ID int `json:"id"`
			} `json:"team"`
			IsWinner bool `json:"isWinner"`
		} `json:"away"`
		Home struct {
			Team struct {
				ID int `json:"id"`
			} `json:"team"`
			IsWinner bool `json:"isWinner"`
		} `json:"home"`
	} `json:"teams"`
}

type mlbSchedulePayload struct {
	Dates []struct {
		Games []scheduleGame `json:"games"`
	} `json:"dates"`
}

func timelineCacheKey(teamID, season int) string {
	return "record-timeline:" + strconv.Itoa(teamID) + ":" + strconv.Itoa(season)
}

func parseRecordTimeline(raw []byte, teamID, season int) (models.RecordTimelineResponse, error) {
	var payload mlbSchedulePayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return models.RecordTimelineResponse{}, err
	}

	var games []scheduleGame
	for _, d := range payload.Dates {
		games = append(games, d.Games...)
	}

	sort.Slice(games, func(i, j int) bool {
		ai := games[i].OfficialDate
		if ai == "" {
			ai = strings.Split(games[i].GameDate, "T")[0]
		}
		aj := games[j].OfficialDate
		if aj == "" {
			aj = strings.Split(games[j].GameDate, "T")[0]
		}
		if ai != aj {
			return ai < aj
		}
		return games[i].GameDate < games[j].GameDate
	})

	wins, losses := 0, 0
	points := make([]models.RecordPoint, 0, len(games))
	for _, g := range games {
		if g.Status.AbstractGameState != "Final" {
			continue
		}
		awayID := g.Teams.Away.Team.ID
		homeID := g.Teams.Home.Team.ID
		if awayID != teamID && homeID != teamID {
			continue
		}

		od := g.OfficialDate
		if od == "" {
			od = strings.Split(g.GameDate, "T")[0]
		}

		var res string
		if g.IsTie {
			res = "T"
		} else if awayID == teamID {
			if g.Teams.Away.IsWinner {
				res = "W"
				wins++
			} else {
				res = "L"
				losses++
			}
		} else if g.Teams.Home.IsWinner {
			res = "W"
			wins++
		} else {
			res = "L"
			losses++
		}

		denom := wins + losses
		pct := 0.0
		if denom > 0 {
			pct = float64(wins) / float64(denom)
		}

		points = append(points, models.RecordPoint{
			GameIndex:    len(points) + 1,
			OfficialDate: od,
			Result:       res,
			Wins:         wins,
			Losses:       losses,
			Pct:          pct,
		})
	}

	return models.RecordTimelineResponse{
		TeamID:   teamID,
		Season:   season,
		Points:   points,
		Finished: len(points),
	}, nil
}

// getOrBuildRecordTimelineBytes returns cached JSON or fetches MLB schedule, builds timeline, caches, returns bytes.
func (h *Handlers) getOrBuildRecordTimelineBytes(ctx context.Context, teamID, season int) ([]byte, error) {
	key := timelineCacheKey(teamID, season)
	if body, ok := h.cache.Get(key); ok {
		return body, nil
	}

	q := url.Values{}
	q.Set("sportId", "1")
	q.Set("season", strconv.Itoa(season))
	q.Set("teamId", strconv.Itoa(teamID))
	q.Set("gameType", "R")
	path := "/schedule?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return nil, err
	}

	out, err := parseRecordTimeline(raw, teamID, season)
	if err != nil {
		return nil, err
	}

	body, err := json.Marshal(out)
	if err != nil {
		return nil, err
	}
	h.cache.Set(key, body, h.cfg.TTLScores)
	return body, nil
}

// RecordTimeline returns cumulative win% after each completed regular-season game for a team.
func (h *Handlers) RecordTimeline(w http.ResponseWriter, r *http.Request) {
	teamIDStr := strings.TrimSpace(chi.URLParam(r, "teamID"))
	teamID, err := strconv.Atoi(teamIDStr)
	if err != nil || teamID <= 0 {
		http.Error(w, "invalid team id", http.StatusBadRequest)
		return
	}

	season := h.cfg.DefaultSeason
	if v := strings.TrimSpace(r.URL.Query().Get("season")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1900 || n > 2100 {
			http.Error(w, "invalid season", http.StatusBadRequest)
			return
		}
		season = n
	}

	body, err := h.getOrBuildRecordTimelineBytes(r.Context(), teamID, season)
	if err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}
