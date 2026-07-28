package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"caught-looking/backend/models"
)

var isoDate = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// GamesForDate lists games on a calendar day (optionally involving one team).
func (h *Handlers) GamesForDate(w http.ResponseWriter, r *http.Request) {
	date := strings.TrimSpace(r.URL.Query().Get("date"))
	if date == "" {
		date = time.Now().UTC().Format("2006-01-02")
	}
	if !isoDate.MatchString(date) {
		respondAPIError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
		return
	}

	var teamID int
	if v := strings.TrimSpace(r.URL.Query().Get("teamId")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			respondAPIError(w, http.StatusBadRequest, "invalid teamId")
			return
		}
		teamID = n
	}

	cacheKey := "games-for-date:" + date + ":" + strconv.Itoa(teamID)
	body, err := h.cache.GetOrLoadWithTTL(r.Context(), cacheKey, func(ctx context.Context) ([]byte, time.Duration, error) {
		q := url.Values{}
		q.Set("sportId", "1")
		q.Set("date", date)
		if teamID > 0 {
			q.Set("teamId", strconv.Itoa(teamID))
		}
		path := "/schedule?" + q.Encode()

		raw, err := h.mlb.Get(ctx, path)
		if err != nil {
			return nil, 0, err
		}

		var payload struct {
			Dates []struct {
				Date  string `json:"date"`
				Games []struct {
					GamePk       int64  `json:"gamePk"`
					OfficialDate string `json:"officialDate"`
					Status       struct {
						AbstractGameState string `json:"abstractGameState"`
						DetailedState     string `json:"detailedState"`
					} `json:"status"`
					Teams struct {
						Away struct {
							Team struct {
								ID   int    `json:"id"`
								Name string `json:"name"`
							} `json:"team"`
							Score int `json:"score"`
						} `json:"away"`
						Home struct {
							Team struct {
								ID   int    `json:"id"`
								Name string `json:"name"`
							} `json:"team"`
							Score int `json:"score"`
						} `json:"home"`
					} `json:"teams"`
				} `json:"games"`
			} `json:"dates"`
		}
		if err := json.Unmarshal(raw, &payload); err != nil {
			return nil, 0, wrapUpstreamJSONParse(err)
		}

		out := models.GamesForDateResponse{Date: date, Games: nil}
		for _, d := range payload.Dates {
			for _, g := range d.Games {
				od := g.OfficialDate
				if od == "" {
					od = d.Date
				}
				out.Games = append(out.Games, models.GameSummary{
					GamePk:       g.GamePk,
					AwayTeam:     g.Teams.Away.Team.Name,
					HomeTeam:     g.Teams.Home.Team.Name,
					AwayID:       g.Teams.Away.Team.ID,
					HomeID:       g.Teams.Home.Team.ID,
					Status:       gameDisplayStatus(g.Status.DetailedState, g.Status.AbstractGameState),
					AwayScore:    g.Teams.Away.Score,
					HomeScore:    g.Teams.Home.Score,
					OfficialDate: od,
				})
			}
		}

		body, err := marshalCachedJSON(out)
		if err != nil {
			return nil, 0, err
		}
		ttl := cacheTTLForDateGames(date, out.Games, h.cfg, time.Now())
		return body, ttl, nil
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body)
}
