package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"caught-looking/backend/models"
)

var leaderCategoriesByGroup = map[string][]string{
	"hitting": {
		"homeRuns",
		"battingAverage",
		"hits",
		"runsBattedIn",
		"onBasePlusSlugging",
		"onBasePercentage",
		"sluggingPercentage",
		"stolenBases",
		"runs",
	},
	"pitching": {
		"earnedRunAverage",
		"wins",
		"strikeouts",
		"saves",
		"walksAndHitsPerInningPitched",
		"strikeoutsPer9Inn",
		"strikeoutWalkRatio",
	},
}

var leaderCategorySet = func() map[string]map[string]struct{} {
	out := make(map[string]map[string]struct{}, len(leaderCategoriesByGroup))
	for group, cats := range leaderCategoriesByGroup {
		set := make(map[string]struct{}, len(cats))
		for _, c := range cats {
			set[c] = struct{}{}
		}
		out[group] = set
	}
	return out
}()

const (
	defaultLeadersLimit = 10
	maxLeadersLimit     = 25
)

type mlbLeadersPayload struct {
	LeagueLeaders []struct {
		LeaderCategory string `json:"leaderCategory"`
		StatGroup      string `json:"statGroup"`
		Leaders        []struct {
			Rank  int    `json:"rank"`
			Value string `json:"value"`
			Team  *struct {
				ID   int    `json:"id"`
				Name string `json:"name"`
			} `json:"team"`
			League *struct {
				Name string `json:"name"`
			} `json:"league"`
			Person struct {
				ID       int64  `json:"id"`
				FullName string `json:"fullName"`
			} `json:"person"`
		} `json:"leaders"`
	} `json:"leagueLeaders"`
}

// Leaders returns regular-season MLB statistical leaders for an allowlisted category.
func (h *Handlers) Leaders(w http.ResponseWriter, r *http.Request) {
	season, err := parseSeasonOrDefault(r.URL.Query().Get("season"), h.cfg.DefaultSeason)
	if err != nil {
		respondAPIError(w, http.StatusBadRequest, "invalid season")
		return
	}

	group, err := parseHittingPitchingGroup(r.URL.Query().Get("group"))
	if err != nil {
		respondAPIError(w, http.StatusBadRequest, "group must be hitting or pitching")
		return
	}

	category, err := parseLeaderCategory(group, r.URL.Query().Get("category"))
	if err != nil {
		respondAPIError(w, http.StatusBadRequest, "invalid category for group")
		return
	}

	limit, err := parseLeadersLimit(r.URL.Query().Get("limit"))
	if err != nil {
		respondAPIError(w, http.StatusBadRequest, "invalid limit")
		return
	}

	cacheKey := "leaders:" + group + ":" + category + ":" + strconv.Itoa(season) + ":" + strconv.Itoa(limit)
	body, ttl, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLStandings, func(ctx context.Context) ([]byte, error) {
		rows, err := h.fetchLeaders(ctx, season, group, category, limit)
		if err != nil {
			return nil, err
		}
		out := models.LeadersResponse{
			Season:     season,
			Group:      group,
			Category:   category,
			Limit:      limit,
			Leaders:    rows,
			Categories: append([]string(nil), leaderCategoriesByGroup[group]...),
		}
		return marshalCachedJSON(out)
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body, ttl)
}

func parseLeaderCategory(group, raw string) (string, error) {
	cat := strings.TrimSpace(raw)
	if cat == "" {
		if group == "pitching" {
			return "earnedRunAverage", nil
		}
		return "homeRuns", nil
	}
	if _, ok := leaderCategorySet[group][cat]; !ok {
		return "", errInvalidCategory
	}
	return cat, nil
}

func parseLeadersLimit(raw string) (int, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return defaultLeadersLimit, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 || n > maxLeadersLimit {
		return 0, errInvalidLimit
	}
	return n, nil
}

func (h *Handlers) fetchLeaders(ctx context.Context, season int, group, category string, limit int) ([]models.LeaderRow, error) {
	q := url.Values{}
	q.Set("leaderCategories", category)
	q.Set("season", strconv.Itoa(season))
	q.Set("sportId", "1")
	q.Set("leaderGameTypes", "R")
	q.Set("statGroup", group)
	q.Set("limit", strconv.Itoa(limit))

	raw, err := h.mlb.Get(ctx, "/stats/leaders?"+q.Encode())
	if err != nil {
		return nil, err
	}

	var payload mlbLeadersPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, wrapUpstreamJSONParse(err)
	}

	rows := make([]models.LeaderRow, 0, limit)
	for _, board := range payload.LeagueLeaders {
		if board.LeaderCategory != "" && board.LeaderCategory != category {
			continue
		}
		for _, entry := range board.Leaders {
			row := models.LeaderRow{
				Rank:       entry.Rank,
				Value:      entry.Value,
				PlayerID:   entry.Person.ID,
				PlayerName: entry.Person.FullName,
			}
			if entry.Team != nil {
				row.TeamID = entry.Team.ID
				row.TeamName = entry.Team.Name
			}
			if entry.League != nil {
				row.LeagueName = entry.League.Name
			}
			rows = append(rows, row)
			if len(rows) >= limit {
				return rows, nil
			}
		}
	}
	return rows, nil
}
