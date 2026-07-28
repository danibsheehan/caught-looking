package handlers

import (
	"strings"
	"time"

	"caught-looking/backend/config"
	"caught-looking/backend/models"
)

// gameDisplayStatus prefers MLB detailedState for the API status string, falling back to
// abstractGameState when detailedState is missing (so Final games are not left blank).
func gameDisplayStatus(detailedState, abstractGameState string) string {
	if s := strings.TrimSpace(detailedState); s != "" {
		return s
	}
	return strings.TrimSpace(abstractGameState)
}

func gameStatusSettled(status string) bool {
	s := strings.ToLower(strings.TrimSpace(status))
	if s == "" {
		return false
	}
	switch {
	case strings.Contains(s, "final"),
		strings.Contains(s, "completed"),
		strings.Contains(s, "game over"),
		strings.Contains(s, "postponed"),
		strings.Contains(s, "cancelled"),
		strings.Contains(s, "canceled"):
		return true
	default:
		return false
	}
}

// cacheTTLForDateGames picks a shorter TTL for today / unsettled games and a longer TTL for
// settled historical scoreboards.
func cacheTTLForDateGames(date string, games []models.GameSummary, cfg config.Config, now time.Time) time.Duration {
	today := now.UTC().Format("2006-01-02")
	unsettled := false
	for _, g := range games {
		if !gameStatusSettled(g.Status) {
			unsettled = true
			break
		}
	}
	switch {
	case date > today:
		return cfg.TTLLiveScores
	case date == today:
		if unsettled || len(games) == 0 {
			return cfg.TTLLiveScores
		}
		return cfg.TTLScores
	default:
		if unsettled {
			return cfg.TTLLiveScores
		}
		return cfg.TTLStandings
	}
}

// cacheTTLForGameStatus picks a short TTL while a game is live/unknown and a long TTL once settled.
func cacheTTLForGameStatus(status string, cfg config.Config) time.Duration {
	if gameStatusSettled(status) {
		return cfg.TTLStandings
	}
	return cfg.TTLLiveScores
}

// cacheTTLForSeason uses a long TTL for completed seasons and a shorter one for the current
// (or future) season, whose schedules and records still change.
func cacheTTLForSeason(season int, cfg config.Config, now time.Time) time.Duration {
	if season > 0 && season < now.UTC().Year() {
		return cfg.TTLStandings
	}
	return cfg.TTLScores
}
