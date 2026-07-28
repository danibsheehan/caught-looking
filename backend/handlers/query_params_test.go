package handlers

import (
	"errors"
	"testing"
)

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
