package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

const (
	minSeasonYear = 1900
	maxSeasonYear = 2100
)

var (
	errInvalidSeason      = errors.New("invalid season")
	errInvalidGroup       = errors.New("invalid hitting/pitching group")
	errInvalidCategory    = errors.New("invalid leader category")
	errInvalidLimit       = errors.New("invalid limit")
	errTwoPlayerIDsFormat = errors.New("ids must be two comma-separated values")
	errInvalidPlayerIDs   = errors.New("invalid player ids")
	errInvalidGamePk      = errors.New("invalid gamePk")
)

// parseSeasonOrDefault returns defaultSeason when raw is empty; otherwise parses a year in [1900, 2100].
func parseSeasonOrDefault(raw string, defaultSeason int) (int, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return defaultSeason, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < minSeasonYear || n > maxSeasonYear {
		return 0, errInvalidSeason
	}
	return n, nil
}

// parseHittingPitchingGroup returns "hitting" or "pitching". Empty raw defaults to "hitting".
func parseHittingPitchingGroup(raw string) (string, error) {
	group := strings.ToLower(strings.TrimSpace(raw))
	if group == "" {
		group = "hitting"
	}
	if group != "hitting" && group != "pitching" {
		return "", errInvalidGroup
	}
	return group, nil
}

// parseTwoPlayerIDs parses query ids as two positive MLB person ids (duplicates allowed).
func parseTwoPlayerIDs(raw string) (id1, id2 int64, err error) {
	parts := strings.Split(strings.TrimSpace(raw), ",")
	if len(parts) != 2 {
		return 0, 0, errTwoPlayerIDsFormat
	}
	id1, err1 := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 64)
	id2, err2 := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
	if err1 != nil || err2 != nil || id1 <= 0 || id2 <= 0 {
		return 0, 0, errInvalidPlayerIDs
	}
	return id1, id2, nil
}

// parseGamePk parses the "gamePk" chi URL param as a positive MLB game id.
func parseGamePk(r *http.Request) (gamePk int64, pkStr string, err error) {
	pkStr = strings.TrimSpace(chi.URLParam(r, "gamePk"))
	gamePk, err = strconv.ParseInt(pkStr, 10, 64)
	if err != nil || gamePk <= 0 {
		return 0, "", errInvalidGamePk
	}
	return gamePk, pkStr, nil
}
