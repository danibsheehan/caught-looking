package handlers

import (
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
		http.Error(w, "date must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}

	var teamID int
	if v := strings.TrimSpace(r.URL.Query().Get("teamId")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			http.Error(w, "invalid teamId", http.StatusBadRequest)
			return
		}
		teamID = n
	}

	cacheKey := "games-for-date:" + date + ":" + strconv.Itoa(teamID)
	if body, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
		return
	}

	q := url.Values{}
	q.Set("sportId", "1")
	q.Set("date", date)
	if teamID > 0 {
		q.Set("teamId", strconv.Itoa(teamID))
	}
	path := "/schedule?" + q.Encode()

	raw, err := h.mlb.Get(r.Context(), path)
	if err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	var payload struct {
		Dates []struct {
			Date  string `json:"date"`
			Games []struct {
				GamePk       int64  `json:"gamePk"`
				OfficialDate string `json:"officialDate"`
				Status       struct {
					DetailedState string `json:"detailedState"`
				} `json:"status"`
				Teams struct {
					Away struct {
						Team  struct{ ID int `json:"id"`; Name string `json:"name"` } `json:"team"`
						Score int `json:"score"`
					} `json:"away"`
					Home struct {
						Team  struct{ ID int `json:"id"`; Name string `json:"name"` } `json:"team"`
						Score int `json:"score"`
					} `json:"home"`
				} `json:"teams"`
			} `json:"games"`
		} `json:"dates"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		http.Error(w, "upstream parse error", http.StatusBadGateway)
		return
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
				Status:       g.Status.DetailedState,
				AwayScore:    g.Teams.Away.Score,
				HomeScore:    g.Teams.Home.Score,
				OfficialDate: od,
			})
		}
	}

	body, err := json.Marshal(out)
	if err != nil {
		http.Error(w, "encode error", http.StatusInternalServerError)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLScores)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}
