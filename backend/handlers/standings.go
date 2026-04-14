package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"caught-looking/backend/models"
)

type mlbStandingsPayload struct {
	Records []struct {
		Division struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
		} `json:"division"`
		League struct {
			ID int `json:"id"`
		} `json:"league"`
		TeamRecords []struct {
			Team struct {
				ID   int    `json:"id"`
				Name string `json:"name"`
			} `json:"team"`
			GamesPlayed       int    `json:"gamesPlayed"`
			DivisionRank      string `json:"divisionRank"`
			WildCardGamesBack string `json:"wildCardGamesBack"`
			GamesBack         string `json:"gamesBack"`
			LeagueRecord      struct {
				Wins   int    `json:"wins"`
				Losses int    `json:"losses"`
				Pct    string `json:"pct"`
			} `json:"leagueRecord"`
		} `json:"teamRecords"`
	} `json:"records"`
}

// Standings returns regular-season standings by division for the requested season and leagues.
func (h *Handlers) Standings(w http.ResponseWriter, r *http.Request) {
	season := h.cfg.DefaultSeason
	if v := strings.TrimSpace(r.URL.Query().Get("season")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1900 || n > 2100 {
			http.Error(w, "invalid season", http.StatusBadRequest)
			return
		}
		season = n
	}

	leagueIDs := strings.TrimSpace(r.URL.Query().Get("leagueId"))
	if leagueIDs == "" {
		leagueIDs = h.cfg.DefaultLeagueIDs
	}
	for _, part := range strings.Split(leagueIDs, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if _, err := strconv.Atoi(part); err != nil {
			http.Error(w, "invalid leagueId", http.StatusBadRequest)
			return
		}
	}

	standingsType := strings.TrimSpace(r.URL.Query().Get("standingsTypes"))
	if standingsType == "" {
		standingsType = "regularSeason"
	}

	cacheKey := "standings:" + strconv.Itoa(season) + ":" + leagueIDs + ":" + standingsType
	if body, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
		return
	}

	q := url.Values{}
	q.Set("season", strconv.Itoa(season))
	q.Set("leagueId", leagueIDs)
	q.Set("standingsTypes", standingsType)
	path := "/standings?" + q.Encode()

	raw, err := h.mlb.Get(r.Context(), path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	var payload mlbStandingsPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		http.Error(w, "upstream parse error", http.StatusBadGateway)
		return
	}

	divNames, err := h.loadDivisionNames(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	divisions := make([]models.StandingDivision, 0, len(payload.Records))
	for _, rec := range payload.Records {
		dname := rec.Division.Name
		if dname == "" {
			dname = divNames[rec.Division.ID]
		}
		teams := make([]models.StandingTeam, 0, len(rec.TeamRecords))
		for _, tr := range rec.TeamRecords {
			teams = append(teams, models.StandingTeam{
				TeamID:        tr.Team.ID,
				TeamName:      tr.Team.Name,
				Wins:          tr.LeagueRecord.Wins,
				Losses:        tr.LeagueRecord.Losses,
				Pct:           tr.LeagueRecord.Pct,
				GamesPlayed:   tr.GamesPlayed,
				DivisionRank:  tr.DivisionRank,
				GamesBack:     tr.GamesBack,
				WildCardGames: tr.WildCardGamesBack,
			})
		}
		divisions = append(divisions, models.StandingDivision{
			DivisionID:   rec.Division.ID,
			DivisionName: dname,
			LeagueID:     rec.League.ID,
			Teams:        teams,
		})
	}

	body, err := json.Marshal(models.StandingsResponse{
		Season:    season,
		Divisions: divisions,
	})
	if err != nil {
		http.Error(w, "encode error", http.StatusInternalServerError)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLStandings)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}
