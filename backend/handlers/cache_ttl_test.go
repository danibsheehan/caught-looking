package handlers

import (
	"testing"
	"time"

	"caught-looking/backend/config"
	"caught-looking/backend/models"
)

func TestCacheTTLForDateGames(t *testing.T) {
	cfg := config.Config{
		TTLLiveScores: 45 * time.Second,
		TTLScores:     5 * time.Minute,
		TTLStandings:  time.Hour,
	}
	now := time.Date(2026, 7, 27, 18, 0, 0, 0, time.UTC)
	today := "2026-07-27"
	past := "2026-07-20"
	future := "2026-07-28"

	live := []models.GameSummary{{Status: "In Progress"}}
	final := []models.GameSummary{{Status: "Final"}, {Status: "Final"}}

	if got := cacheTTLForDateGames(today, live, cfg, now); got != cfg.TTLLiveScores {
		t.Fatalf("today live: got %v", got)
	}
	if got := cacheTTLForDateGames(today, final, cfg, now); got != cfg.TTLScores {
		t.Fatalf("today all final: got %v", got)
	}
	if got := cacheTTLForDateGames(past, final, cfg, now); got != cfg.TTLStandings {
		t.Fatalf("past final: got %v", got)
	}
	if got := cacheTTLForDateGames(past, live, cfg, now); got != cfg.TTLLiveScores {
		t.Fatalf("past unsettled: got %v", got)
	}
	if got := cacheTTLForDateGames(future, nil, cfg, now); got != cfg.TTLLiveScores {
		t.Fatalf("future: got %v", got)
	}
}

func TestGameStatusSettled(t *testing.T) {
	if !gameStatusSettled("Final") || !gameStatusSettled("Postponed") {
		t.Fatal("expected settled")
	}
	if gameStatusSettled("In Progress") || gameStatusSettled("Pre-Game") || gameStatusSettled("") {
		t.Fatal("expected unsettled")
	}
}

func TestGameDisplayStatus(t *testing.T) {
	if got := gameDisplayStatus("Final", "Final"); got != "Final" {
		t.Fatalf("prefer detailed: %q", got)
	}
	if got := gameDisplayStatus("", "Final"); got != "Final" {
		t.Fatalf("fallback abstract: %q", got)
	}
	if got := gameDisplayStatus("In Progress", "Live"); got != "In Progress" {
		t.Fatalf("detailed wins: %q", got)
	}
	if got := gameDisplayStatus("", ""); got != "" {
		t.Fatalf("empty: %q", got)
	}
}

func TestCacheTTLForGameStatus(t *testing.T) {
	cfg := config.Config{
		TTLLiveScores: 45 * time.Second,
		TTLStandings:  time.Hour,
	}
	if got := cacheTTLForGameStatus("Final", cfg); got != cfg.TTLStandings {
		t.Fatalf("final: got %v", got)
	}
	if got := cacheTTLForGameStatus("In Progress", cfg); got != cfg.TTLLiveScores {
		t.Fatalf("live: got %v", got)
	}
	if got := cacheTTLForGameStatus("", cfg); got != cfg.TTLLiveScores {
		t.Fatalf("unknown: got %v", got)
	}
}

func TestCacheTTLForSeason(t *testing.T) {
	cfg := config.Config{
		TTLScores:    5 * time.Minute,
		TTLStandings: time.Hour,
	}
	now := time.Date(2026, 7, 28, 12, 0, 0, 0, time.UTC)
	if got := cacheTTLForSeason(2025, cfg, now); got != cfg.TTLStandings {
		t.Fatalf("past season: got %v", got)
	}
	if got := cacheTTLForSeason(2026, cfg, now); got != cfg.TTLScores {
		t.Fatalf("current season: got %v", got)
	}
	if got := cacheTTLForSeason(2027, cfg, now); got != cfg.TTLScores {
		t.Fatalf("future season: got %v", got)
	}
}

func TestScheduleGameDisplayStatus(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[{"status":{"detailedState":"Final","abstractGameState":"Final"}}]}]}`)
	if got := scheduleGameDisplayStatus(raw); got != "Final" {
		t.Fatalf("got %q", got)
	}
	if got := scheduleGameDisplayStatus([]byte(`{"dates":[]}`)); got != "" {
		t.Fatalf("empty dates: %q", got)
	}
	if got := scheduleGameDisplayStatus([]byte(`not-json`)); got != "" {
		t.Fatalf("bad json: %q", got)
	}
}

func TestCacheTTLForDateGames_abstractFinalWithoutDetailed(t *testing.T) {
	cfg := config.Config{
		TTLLiveScores: 45 * time.Second,
		TTLScores:     5 * time.Minute,
		TTLStandings:  time.Hour,
	}
	now := time.Date(2026, 7, 27, 18, 0, 0, 0, time.UTC)
	// Status as filled by gameDisplayStatus when MLB omits detailedState.
	games := []models.GameSummary{{Status: gameDisplayStatus("", "Final")}}
	if got := cacheTTLForDateGames("2026-07-20", games, cfg, now); got != cfg.TTLStandings {
		t.Fatalf("past abstract Final: got %v want standings TTL", got)
	}
	if got := cacheTTLForDateGames("2026-07-27", games, cfg, now); got != cfg.TTLScores {
		t.Fatalf("today abstract Final: got %v want scores TTL", got)
	}
}
