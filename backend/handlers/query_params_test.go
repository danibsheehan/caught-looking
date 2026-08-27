package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

// newGamePkRequest builds a request with a chi route context carrying the given "gamePk" URL param,
// matching how parseGamePk reads it via chi.URLParam in the real router.
func newGamePkRequest(gamePk string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("gamePk", gamePk)
	req := httptest.NewRequest(http.MethodGet, "/games/"+gamePk+"/boxscore", nil)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func TestParseSeasonOrDefault(t *testing.T) {
	t.Parallel()
	got, err := parseSeasonOrDefault("", 2026)
	if err != nil || got != 2026 {
		t.Fatalf("empty: got %d %v", got, err)
	}
	got, err = parseSeasonOrDefault(" 2019 ", 2026)
	if err != nil || got != 2019 {
		t.Fatalf("valid: got %d %v", got, err)
	}
	if _, err := parseSeasonOrDefault("abc", 2026); !errors.Is(err, errInvalidSeason) {
		t.Fatalf("want errInvalidSeason, got %v", err)
	}
	if _, err := parseSeasonOrDefault("1899", 2026); !errors.Is(err, errInvalidSeason) {
		t.Fatalf("low: %v", err)
	}
	if _, err := parseSeasonOrDefault("2101", 2026); !errors.Is(err, errInvalidSeason) {
		t.Fatalf("high: %v", err)
	}
}

func TestParseHittingPitchingGroup(t *testing.T) {
	t.Parallel()
	got, err := parseHittingPitchingGroup("")
	if err != nil || got != "hitting" {
		t.Fatalf("default: %q %v", got, err)
	}
	got, err = parseHittingPitchingGroup(" Pitching ")
	if err != nil || got != "pitching" {
		t.Fatalf("pitching: %q %v", got, err)
	}
	if _, err := parseHittingPitchingGroup("fielding"); !errors.Is(err, errInvalidGroup) {
		t.Fatalf("want errInvalidGroup, got %v", err)
	}
}

func TestParseTwoPlayerIDs(t *testing.T) {
	t.Parallel()
	a, b, err := parseTwoPlayerIDs("545361,592450")
	if err != nil || a != 545361 || b != 592450 {
		t.Fatalf("ok: %d %d %v", a, b, err)
	}
	a, b, err = parseTwoPlayerIDs("1,1")
	if err != nil || a != 1 || b != 1 {
		t.Fatalf("duplicates allowed: %d %d %v", a, b, err)
	}
	if _, _, err := parseTwoPlayerIDs("1"); !errors.Is(err, errTwoPlayerIDsFormat) {
		t.Fatalf("format: %v", err)
	}
	if _, _, err := parseTwoPlayerIDs("0,1"); !errors.Is(err, errInvalidPlayerIDs) {
		t.Fatalf("zero: %v", err)
	}
	if _, _, err := parseTwoPlayerIDs("x,1"); !errors.Is(err, errInvalidPlayerIDs) {
		t.Fatalf("parse: %v", err)
	}
}

func TestParseGamePk(t *testing.T) {
	t.Parallel()
	gamePk, pkStr, err := parseGamePk(newGamePkRequest("745444"))
	if err != nil || gamePk != 745444 || pkStr != "745444" {
		t.Fatalf("ok: %d %q %v", gamePk, pkStr, err)
	}
	if _, _, err := parseGamePk(newGamePkRequest("0")); !errors.Is(err, errInvalidGamePk) {
		t.Fatalf("zero: %v", err)
	}
	if _, _, err := parseGamePk(newGamePkRequest("-1")); !errors.Is(err, errInvalidGamePk) {
		t.Fatalf("negative: %v", err)
	}
	if _, _, err := parseGamePk(newGamePkRequest("abc")); !errors.Is(err, errInvalidGamePk) {
		t.Fatalf("non-numeric: %v", err)
	}
	if _, _, err := parseGamePk(newGamePkRequest("")); !errors.Is(err, errInvalidGamePk) {
		t.Fatalf("empty: %v", err)
	}
}
