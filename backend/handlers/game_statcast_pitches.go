package handlers

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"caught-looking/backend/models"

	"github.com/go-chi/chi/v5"
)

// GameStatcastPitches returns Statcast pitch-level rows (plate location, pitch type) for one game from Savant CSV.
func (h *Handlers) GameStatcastPitches(w http.ResponseWriter, r *http.Request) {
	pkStr := strings.TrimSpace(chi.URLParam(r, "gamePk"))
	gamePk, err := strconv.ParseInt(pkStr, 10, 64)
	if err != nil || gamePk <= 0 {
		respondAPIError(w, http.StatusBadRequest, "invalid gamePk")
		return
	}

	cacheKey := "game-statcast-pitches-v4:" + pkStr
	body, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLStatcast, func(ctx context.Context) ([]byte, error) {
		raw, err := h.fetchSavantGameCSV(ctx, pkStr)
		if err != nil {
			return nil, err
		}
		out := models.GameStatcastPitchesResponse{
			GamePk:  gamePk,
			Pitches: parseStatcastPitchesCSV(raw),
		}
		return json.Marshal(out)
	})
	if err != nil {
		respondUpstreamError(w, r, err)
		return
	}
	writeJSONBytes(w, body)
}

func parseStatcastPitchesCSV(raw []byte) []models.StatcastPitch {
	out := make([]models.StatcastPitch, 0, 128)
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

	pxi := columnIndex(idx, "plate_x")
	pzi := columnIndex(idx, "plate_z")
	nameI := columnIndex(idx, "pitch_name")
	typeI := columnIndex(idx, "pitch_type")
	pi := columnIndex(idx, "pitcher")
	rsI := columnIndex(idx, "release_speed")
	th := columnIndex(idx, "inning_topbot")
	szTopI := columnIndex(idx, "sz_top")
	szBotI := columnIndex(idx, "sz_bot")
	standI := columnIndex(idx, "stand")

	if pxi < 0 || pzi < 0 || pi < 0 {
		return out
	}

	for {
		rec, err := r.Read()
		if err != nil {
			break
		}
		minLen := maxInt(pxi, pzi, pi)
		if len(rec) <= minLen {
			continue
		}
		px, okX := parseCSVFloat(rec, pxi)
		pz, okZ := parseCSVFloat(rec, pzi)
		if !okX || !okZ {
			continue
		}

		row := models.StatcastPitch{
			PlateX:  px,
			PlateZ:  pz,
			Pitcher: parseCSVInt(rec, pi),
		}
		if nameI >= 0 && nameI < len(rec) {
			row.PitchName = strings.TrimSpace(rec[nameI])
		}
		if typeI >= 0 && typeI < len(rec) {
			if pt := strings.TrimSpace(rec[typeI]); pt != "" {
				row.PitchType = strings.ToUpper(pt)
			}
		}
		// Legacy CSVs: only `pitch_type` (abbrev) with no `pitch_name` column.
		if row.PitchName == "" && typeI >= 0 && typeI < len(rec) {
			row.PitchName = strings.TrimSpace(rec[typeI])
		}
		if rsI >= 0 {
			if rs, ok := parseCSVFloat(rec, rsI); ok {
				row.ReleaseSpeed = &rs
			}
		}
		if th >= 0 && th < len(rec) {
			row.InningHalf = normalizeInningTopBot(strings.TrimSpace(rec[th]))
		}
		if szTopI >= 0 {
			if v, ok := parseCSVFloat(rec, szTopI); ok {
				row.SzTop = &v
			}
		}
		if szBotI >= 0 {
			if v, ok := parseCSVFloat(rec, szBotI); ok {
				row.SzBot = &v
			}
		}
		if standI >= 0 && standI < len(rec) {
			row.BatterStand = normalizeBatterStand(strings.TrimSpace(rec[standI]))
		}
		out = append(out, row)
	}
	return out
}
