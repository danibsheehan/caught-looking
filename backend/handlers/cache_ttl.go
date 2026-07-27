package handlers

import (
	"strings"
	"time"

	"caught-looking/backend/config"
	"caught-looking/backend/models"
)

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
