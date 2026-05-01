package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
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
		http.Error(w, "invalid gamePk", http.StatusBadRequest)
		return
	}

	cacheKey := "game-boxscore:" + pkStr
	if body, ok := h.cache.Get(cacheKey); ok {
		writeJSONBytes(w, body)
		return
	}

	raw, err := h.mlb.Get(r.Context(), "/game/"+pkStr+"/boxscore")
	if err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	var root mlbBoxscoreRoot
	if err := json.Unmarshal(raw, &root); err != nil {
		respondUpstreamJSONParseError(w)
		return
	}

	out := models.GameBoxscoreResponse{
		GamePk: gamePk,
		Away:   buildTeamSide(root.Teams.Away),
		Home:   buildTeamSide(root.Teams.Home),
	}

	body, err := json.Marshal(out)
	if err != nil {
		respondJSONEncodeError(w)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLScores)
	writeJSONBytes(w, body)
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
