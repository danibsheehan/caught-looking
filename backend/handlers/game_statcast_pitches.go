package handlers

import (
	"bytes"
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
		http.Error(w, "invalid gamePk", http.StatusBadRequest)
		return
	}

	cacheKey := "game-statcast-pitches-v3:" + pkStr
	if body, ok := h.cache.Get(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
		return
	}

	ctx := r.Context()
	raw, err := h.savant.Get(ctx, statcastSingleGamePath+pkStr)
	if err != nil {
		respondUpstreamError(w, r, err)
		return
	}

	pitches := parseStatcastPitchesCSV(raw)
	out := models.GameStatcastPitchesResponse{
		GamePk:  gamePk,
		Pitches: pitches,
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
	pitchI := columnIndex(idx, "pitch_name")
	if pitchI < 0 {
		pitchI = columnIndex(idx, "pitch_type")
	}
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
		if pitchI >= 0 && pitchI < len(rec) {
			row.PitchName = strings.TrimSpace(rec[pitchI])
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
