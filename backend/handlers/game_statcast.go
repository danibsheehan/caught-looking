package handlers

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"
)

// statcastSingleGamePath is the Savant Statcast Search CSV URL for one MLB game (game_pk).
// See: https://baseballsavant.mlb.com/csv-docs
const statcastSingleGamePath = "/statcast_search/csv?all=true&type=details&game_pk="

// GameStatcast returns Statcast batted-ball rows (launch speed / angle) for a single game from Baseball Savant CSV.
func (h *Handlers) GameStatcast(w http.ResponseWriter, r *http.Request) {
	pkStr := strings.TrimSpace(chi.URLParam(r, "gamePk"))
	gamePk, err := strconv.ParseInt(pkStr, 10, 64)
	if err != nil || gamePk <= 0 {
		http.Error(w, "invalid gamePk", http.StatusBadRequest)
		return
	}

	cacheKey := "game-statcast:" + pkStr
	if body, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
		return
	}

	ctx := r.Context()
	g, gctx := errgroup.WithContext(ctx)
	var raw []byte
	var rawSchedule []byte
	g.Go(func() error {
		var err error
		raw, err = h.savant.Get(gctx, statcastSingleGamePath+pkStr)
		return err
	})
	g.Go(func() error {
		b, err := h.mlb.Get(gctx, "/schedule?sportId=1&gamePks="+pkStr)
		if err != nil {
			log.Printf("%s %s: schedule (venue) optional fetch: %v", r.Method, r.URL.Path, err)
			return nil
		}
		rawSchedule = b
		return nil
	})
	if err := g.Wait(); err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	balls := parseStatcastBattedBallsCSV(raw)
	out := models.GameStatcastResponse{
		GamePk:      gamePk,
		BattedBalls: balls,
	}
	if len(rawSchedule) > 0 {
		var sched struct {
			Dates []struct {
				Games []struct {
					Venue *struct {
						ID   int    `json:"id"`
						Name string `json:"name"`
					} `json:"venue"`
				} `json:"games"`
			} `json:"dates"`
		}
		if err := json.Unmarshal(rawSchedule, &sched); err != nil {
			log.Printf("GET %s: schedule parse for venue: %v", r.URL.Path, err)
		} else if len(sched.Dates) > 0 && len(sched.Dates[0].Games) > 0 && sched.Dates[0].Games[0].Venue != nil {
			v := sched.Dates[0].Games[0].Venue
			out.VenueID = v.ID
			out.VenueName = strings.TrimSpace(v.Name)
		}
	}

	body, err := json.Marshal(out)
	if err != nil {
		http.Error(w, "encode error", http.StatusInternalServerError)
		return
	}

	h.cache.Set(cacheKey, body, h.cfg.TTLStatcast)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

func parseStatcastBattedBallsCSV(raw []byte) []models.StatcastBattedBall {
	out := make([]models.StatcastBattedBall, 0, 32)
	raw = bytes.TrimPrefix(raw, []byte("\xef\xbb\xbf"))
	r := csv.NewReader(bytes.NewReader(raw))
	r.ReuseRecord = true
	r.LazyQuotes = true

	header, err := r.Read()
	if err != nil || len(header) == 0 {
		return out
	}

	idx := make(map[string]int, len(header))
	for i, h := range header {
		idx[strings.TrimSpace(h)] = i
	}

	lsi, ok1 := idx["launch_speed"]
	lai, ok2 := idx["launch_angle"]
	if !ok1 || !ok2 {
		return out
	}

	bi := columnIndex(idx, "batter")
	pi := columnIndex(idx, "pitcher")
	pni := columnIndex(idx, "player_name")
	ei := columnIndex(idx, "events")
	th := columnIndex(idx, "inning_topbot")
	hxi := columnIndex(idx, "hc_x")
	hyi := columnIndex(idx, "hc_y")

	for {
		rec, err := r.Read()
		if err != nil {
			break
		}
		minLen := maxInt(lsi, lai)
		if bi >= 0 {
			minLen = maxInt(minLen, bi)
		}
		if pi >= 0 {
			minLen = maxInt(minLen, pi)
		}
		if hxi >= 0 {
			minLen = maxInt(minLen, hxi)
		}
		if hyi >= 0 {
			minLen = maxInt(minLen, hyi)
		}
		if len(rec) <= minLen {
			continue
		}
		ls, okA := parseCSVFloat(rec, lsi)
		la, okB := parseCSVFloat(rec, lai)
		if !okA || !okB {
			continue
		}

		row := models.StatcastBattedBall{
			LaunchSpeed: &ls,
			LaunchAngle: &la,
			Batter:      parseCSVInt(rec, bi),
			Pitcher:     parseCSVInt(rec, pi),
		}
		if pni >= 0 && pni < len(rec) {
			row.PlayerName = strings.TrimSpace(rec[pni])
		}
		if ei >= 0 && ei < len(rec) {
			row.Events = strings.TrimSpace(rec[ei])
		}
		if th >= 0 && th < len(rec) {
			row.InningHalf = normalizeInningTopBot(strings.TrimSpace(rec[th]))
		}
		if hxi >= 0 {
			if x, ok := parseCSVFloat(rec, hxi); ok {
				row.HCX = &x
			}
		}
		if hyi >= 0 {
			if y, ok := parseCSVFloat(rec, hyi); ok {
				row.HCY = &y
			}
		}
		out = append(out, row)
	}
	return out
}

// Savant uses "Top" / "Bot"; normalize so API consumers can match "Top" / "Bottom".
func normalizeInningTopBot(s string) string {
	if s == "" {
		return ""
	}
	switch strings.ToLower(s) {
	case "top":
		return "Top"
	case "bottom", "bot":
		return "Bottom"
	default:
		return s
	}
}

// normalizeBatterStand normalizes Savant `stand` to L, R, or S; empty if unknown.
func normalizeBatterStand(s string) string {
	if s == "" {
		return ""
	}
	switch strings.ToLower(s) {
	case "l":
		return "L"
	case "r":
		return "R"
	case "s":
		return "S"
	default:
		return ""
	}
}

func columnIndex(idx map[string]int, name string) int {
	if i, ok := idx[name]; ok {
		return i
	}
	return -1
}

func maxInt(vals ...int) int {
	m := -1
	for _, v := range vals {
		if v > m {
			m = v
		}
	}
	return m
}

func parseCSVFloat(rec []string, i int) (float64, bool) {
	if i < 0 || i >= len(rec) {
		return 0, false
	}
	s := strings.TrimSpace(rec[i])
	if s == "" || strings.EqualFold(s, "null") {
		return 0, false
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return f, true
}

func parseCSVInt(rec []string, i int) int {
	if i < 0 || i >= len(rec) {
		return 0
	}
	s := strings.TrimSpace(rec[i])
	if s == "" {
		return 0
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}
