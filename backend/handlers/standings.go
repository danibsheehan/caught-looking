package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"caught-looking/backend/models"

	"golang.org/x/sync/errgroup"
)

type mlbSplitRecord struct {
	Wins   int    `json:"wins"`
	Losses int    `json:"losses"`
	Type   string `json:"type"`
}

type mlbTeamStandingRow struct {
	Team struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"team"`
	GamesPlayed       int    `json:"gamesPlayed"`
	DivisionRank      string `json:"divisionRank"`
	WildCardGamesBack string `json:"wildCardGamesBack"`
	GamesBack         string `json:"gamesBack"`
	RunsScored        int    `json:"runsScored"`
	RunsAllowed       int    `json:"runsAllowed"`
	RunDifferential   int    `json:"runDifferential"`
	Streak            struct {
		StreakCode string `json:"streakCode"`
	} `json:"streak"`
	Records *struct {
		SplitRecords []mlbSplitRecord `json:"splitRecords"`
	} `json:"records"`
	LeagueRecord struct {
		Wins   int    `json:"wins"`
		Losses int    `json:"losses"`
		Pct    string `json:"pct"`
	} `json:"leagueRecord"`
}

type mlbStandingsPayload struct {
	Records []struct {
		Division struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
		} `json:"division"`
		League struct {
			ID int `json:"id"`
		} `json:"league"`
		TeamRecords []mlbTeamStandingRow `json:"teamRecords"`
	} `json:"records"`
}

func winsLossesFromSplits(splits []mlbSplitRecord, typ string) (wins, losses int) {
	for _, s := range splits {
		if s.Type == typ {
			return s.Wins, s.Losses
		}
	}
	return 0, 0
}

// Standings returns regular-season standings by division for the requested season and leagues.
func (h *Handlers) Standings(w http.ResponseWriter, r *http.Request) {
	season, err := parseSeasonOrDefault(r.URL.Query().Get("season"), h.cfg.DefaultSeason)
	if err != nil {
		respondAPIError(w, http.StatusBadRequest, "invalid season")
		return
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
			respondAPIError(w, http.StatusBadRequest, "invalid leagueId")
			return
		}
	}

	standingsType := strings.TrimSpace(r.URL.Query().Get("standingsTypes"))
	if standingsType == "" {
		standingsType = "regularSeason"
	}

	cacheKey := "standings:" + strconv.Itoa(season) + ":" + leagueIDs + ":" + standingsType
	body, ttl, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLStandings, func(ctx context.Context) ([]byte, error) {
		q := url.Values{}
		q.Set("season", strconv.Itoa(season))
		q.Set("leagueId", leagueIDs)
		q.Set("standingsTypes", standingsType)
		path := "/standings?" + q.Encode()

		var raw []byte
		var divNames map[int]string
		grp, ctx := errgroup.WithContext(ctx)
		grp.Go(func() error {
			var err error
			raw, err = h.mlb.Get(ctx, path)
			return err
		})
		grp.Go(func() error {
			var err error
			divNames, err = h.loadDivisionNames(ctx)
			return err
		})
		if err := grp.Wait(); err != nil {
			return nil, err
		}

		var payload mlbStandingsPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			return nil, wrapUpstreamJSONParse(err)
		}

		divisions := make([]models.StandingDivision, 0, len(payload.Records))
		for _, rec := range payload.Records {
			dname := rec.Division.Name
			if dname == "" {
				dname = divNames[rec.Division.ID]
			}
			teams := make([]models.StandingTeam, 0, len(rec.TeamRecords))
			for _, tr := range rec.TeamRecords {
				var splits []mlbSplitRecord
				if tr.Records != nil {
					splits = tr.Records.SplitRecords
				}
				hw, hl := winsLossesFromSplits(splits, "home")
				aw, al := winsLossesFromSplits(splits, "away")
				l10w, l10l := winsLossesFromSplits(splits, "lastTen")
				streak := strings.TrimSpace(tr.Streak.StreakCode)
				teams = append(teams, models.StandingTeam{
					TeamID:          tr.Team.ID,
					TeamName:        tr.Team.Name,
					Wins:            tr.LeagueRecord.Wins,
					Losses:          tr.LeagueRecord.Losses,
					Pct:             tr.LeagueRecord.Pct,
					GamesPlayed:     tr.GamesPlayed,
					DivisionRank:    tr.DivisionRank,
					GamesBack:       tr.GamesBack,
					WildCardGames:   tr.WildCardGamesBack,
					RunsScored:      tr.RunsScored,
					RunsAllowed:     tr.RunsAllowed,
					RunDifferential: tr.RunDifferential,
					Streak:          streak,
					HomeWins:        hw,
					HomeLosses:      hl,
					AwayWins:        aw,
					AwayLosses:      al,
					LastTenWins:     l10w,
					LastTenLosses:   l10l,
				})
			}
			divisions = append(divisions, models.StandingDivision{
				DivisionID:   rec.Division.ID,
				DivisionName: dname,
				LeagueID:     rec.League.ID,
				Teams:        teams,
			})
		}

		return marshalCachedJSON(models.StandingsResponse{
			Season:    season,
			Divisions: divisions,
		})
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body, ttl)
}
