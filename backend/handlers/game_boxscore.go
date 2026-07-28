package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"
)

type mlbBoxscoreSide struct {
	Team struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"team"`
	TeamStats struct {
		Batting  map[string]interface{} `json:"batting"`
		Pitching map[string]interface{} `json:"pitching"`
		Fielding map[string]interface{} `json:"fielding"`
	} `json:"teamStats"`
	Batters  []int                `json:"batters"`
	Pitchers []int                `json:"pitchers"`
	Players  map[string]boxPlayer `json:"players"`
}

type boxPlayer struct {
	Person struct {
		ID       int    `json:"id"`
		FullName string `json:"fullName"`
	} `json:"person"`
	Position struct {
		Abbreviation string `json:"abbreviation"`
	} `json:"position"`
	Stats struct {
		Batting  map[string]interface{} `json:"batting"`
		Pitching map[string]interface{} `json:"pitching"`
	} `json:"stats"`
}

type mlbBoxscoreRoot struct {
	Teams struct {
		Away mlbBoxscoreSide `json:"away"`
		Home mlbBoxscoreSide `json:"home"`
	} `json:"teams"`
}

// GameBoxscore returns team totals, batting, and pitching lines from the box score feed.
func (h *Handlers) GameBoxscore(w http.ResponseWriter, r *http.Request) {
	pkStr := strings.TrimSpace(chi.URLParam(r, "gamePk"))
	gamePk, err := strconv.ParseInt(pkStr, 10, 64)
	if err != nil || gamePk <= 0 {
		respondAPIError(w, http.StatusBadRequest, "invalid gamePk")
		return
	}

	cacheKey := "game-boxscore:" + pkStr
	body, err := h.cache.GetOrLoadWithTTL(r.Context(), cacheKey, func(ctx context.Context) ([]byte, time.Duration, error) {
		g, gctx := errgroup.WithContext(ctx)
		var raw []byte
		var status string
		g.Go(func() error {
			b, err := h.fetchGameBoxscoreRaw(gctx, pkStr)
			if err != nil {
				return err
			}
			raw = b
			return nil
		})
		g.Go(func() error {
			// Best-effort status for the API response TTL (raw boxscore cache has its own TTL).
			b, err := h.mlb.Get(gctx, "/schedule?sportId=1&gamePks="+pkStr)
			if err != nil {
				return nil
			}
			status = scheduleGameDisplayStatus(b)
			return nil
		})
		if err := g.Wait(); err != nil {
			return nil, 0, err
		}

		var root mlbBoxscoreRoot
		if err := json.Unmarshal(raw, &root); err != nil {
			return nil, 0, wrapUpstreamJSONParse(err)
		}

		out := models.GameBoxscoreResponse{
			GamePk: gamePk,
			Away:   buildTeamSide(root.Teams.Away),
			Home:   buildTeamSide(root.Teams.Home),
		}
		body, err := marshalCachedJSON(out)
		if err != nil {
			return nil, 0, err
		}
		return body, cacheTTLForGameStatus(status, h.cfg), nil
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body)
}

// fetchGameBoxscoreRaw returns MLB /game/{pk}/boxscore JSON, coalesced so timeline and boxscore
// share one upstream download per gamePk.
func (h *Handlers) fetchGameBoxscoreRaw(ctx context.Context, pkStr string) ([]byte, error) {
	key := "mlb-boxscore-raw:" + pkStr
	return h.cache.GetOrLoadWithTTL(ctx, key, func(ctx context.Context) ([]byte, time.Duration, error) {
		g, gctx := errgroup.WithContext(ctx)
		var raw []byte
		var status string
		g.Go(func() error {
			var err error
			raw, err = h.mlb.Get(gctx, "/game/"+pkStr+"/boxscore")
			return err
		})
		g.Go(func() error {
			b, err := h.mlb.Get(gctx, "/schedule?sportId=1&gamePks="+pkStr)
			if err != nil {
				return nil
			}
			status = scheduleGameDisplayStatus(b)
			return nil
		})
		if err := g.Wait(); err != nil {
			return nil, 0, err
		}
		return raw, cacheTTLForGameStatus(status, h.cfg), nil
	})
}

// scheduleGameDisplayStatus extracts a display status from an MLB schedule JSON body for one game.
func scheduleGameDisplayStatus(raw []byte) string {
	var payload struct {
		Dates []struct {
			Games []struct {
				Status struct {
					AbstractGameState string `json:"abstractGameState"`
					DetailedState     string `json:"detailedState"`
				} `json:"status"`
			} `json:"games"`
		} `json:"dates"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ""
	}
	for _, d := range payload.Dates {
		for _, g := range d.Games {
			return gameDisplayStatus(g.Status.DetailedState, g.Status.AbstractGameState)
		}
	}
	return ""
}

func buildTeamSide(side mlbBoxscoreSide) models.TeamBoxSide {
	// Non-nil empty slices so JSON is [] not null (nil [] marshals to null; the UI maps over these).
	t := models.TeamBoxSide{
		TeamID:   side.Team.ID,
		TeamName: side.Team.Name,
		Totals: teamTotalsFrom(
			side.TeamStats.Batting,
			side.TeamStats.Fielding,
		),
		Batting:  []models.BatterLine{},
		Pitching: []models.PitcherLine{},
	}

	for _, pid := range side.Batters {
		key := "ID" + strconv.Itoa(pid)
		p, ok := side.Players[key]
		if !ok {
			continue
		}
		bl := batterFromPlayer(p)
		if bl == nil {
			continue
		}
		t.Batting = append(t.Batting, *bl)
	}

	for _, pid := range side.Pitchers {
		key := "ID" + strconv.Itoa(pid)
		p, ok := side.Players[key]
		if !ok {
			continue
		}
		pl := pitcherFromPlayer(p)
		if pl == nil {
			continue
		}
		t.Pitching = append(t.Pitching, *pl)
	}

	return t
}

func teamTotalsFrom(batting, fielding map[string]interface{}) models.TeamGameTotals {
	return models.TeamGameTotals{
		Runs:       flexInt(batting, "runs"),
		Hits:       flexInt(batting, "hits"),
		Errors:     flexInt(fielding, "errors"),
		LeftOnBase: flexInt(batting, "leftOnBase"),
		Doubles:    flexInt(batting, "doubles"),
		Triples:    flexInt(batting, "triples"),
		HomeRuns:   flexInt(batting, "homeRuns"),
	}
}

func batterFromPlayer(p boxPlayer) *models.BatterLine {
	b := p.Stats.Batting
	if len(b) == 0 {
		return nil
	}
	ab := flexInt(b, "atBats")
	pa := flexInt(b, "plateAppearances")
	if ab == 0 && pa == 0 {
		return nil
	}
	pos := strings.TrimSpace(p.Position.Abbreviation)
	if pos == "" {
		pos = "—"
	}
	return &models.BatterLine{
		PlayerID: p.Person.ID,
		Name:     strings.TrimSpace(p.Person.FullName),
		Pos:      pos,
		AB:       ab,
		R:        flexInt(b, "runs"),
		H:        flexInt(b, "hits"),
		Doubles:  flexInt(b, "doubles"),
		Triples:  flexInt(b, "triples"),
		HR:       flexInt(b, "homeRuns"),
		RBI:      flexInt(b, "rbi"),
		BB:       flexInt(b, "baseOnBalls"),
		SO:       flexInt(b, "strikeOuts"),
	}
}

func pitcherFromPlayer(p boxPlayer) *models.PitcherLine {
	pit := p.Stats.Pitching
	if len(pit) == 0 || !hasPitchingLine(pit) {
		return nil
	}
	ip := flexString(pit, "inningsPitched")
	return &models.PitcherLine{
		PlayerID: p.Person.ID,
		Name:     strings.TrimSpace(p.Person.FullName),
		IP:       ip,
		H:        flexInt(pit, "hits"),
		R:        flexInt(pit, "runs"),
		ER:       flexInt(pit, "earnedRuns"),
		BB:       flexInt(pit, "baseOnBalls"),
		SO:       flexInt(pit, "strikeOuts"),
		HR:       flexInt(pit, "homeRuns"),
	}
}

func hasPitchingLine(pit map[string]interface{}) bool {
	ip := strings.TrimSpace(flexString(pit, "inningsPitched"))
	if ip != "" && ip != "0.0" && ip != "0" {
		return true
	}
	if flexInt(pit, "battersFaced") > 0 {
		return true
	}
	if flexInt(pit, "outs") > 0 {
		return true
	}
	return false
}

func flexInt(m map[string]interface{}, key string) int {
	if m == nil {
		return 0
	}
	v, ok := m[key]
	if !ok || v == nil {
		return 0
	}
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case string:
		t = strings.TrimSpace(t)
		if t == "" || t == "-.--" {
			return 0
		}
		n, err := strconv.Atoi(t)
		if err == nil {
			return n
		}
		f, err := strconv.ParseFloat(t, 64)
		if err == nil {
			return int(f)
		}
		return 0
	default:
		return 0
	}
}

func flexString(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case int:
		return strconv.Itoa(t)
	default:
		return ""
	}
}
