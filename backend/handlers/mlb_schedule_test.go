package handlers

import "testing"

func TestScheduleGameFinalPlayed(t *testing.T) {
	t.Parallel()
	final := mlbScheduleGame{}
	final.Status.AbstractGameState = "Final"
	final.Status.DetailedState = "Final"
	if !scheduleGameFinalPlayed(final) {
		t.Fatal("final played")
	}
	postponed := final
	postponed.Status.DetailedState = "Postponed"
	if scheduleGameFinalPlayed(postponed) {
		t.Fatal("postponed")
	}
	live := final
	live.Status.AbstractGameState = "Live"
	if scheduleGameFinalPlayed(live) {
		t.Fatal("live")
	}
}

func TestTimelineGameCountable_requiresWinner(t *testing.T) {
	t.Parallel()
	g := mlbScheduleGame{}
	g.Status.AbstractGameState = "Final"
	g.Status.DetailedState = "Final"
	if timelineGameCountable(g) {
		t.Fatal("no winner should be skipped for timeline")
	}
	if !venueGameCountable(g) {
		t.Fatal("venue still counts final without winner (scores checked separately)")
	}
	g.Teams.Home.IsWinner = true
	if !timelineGameCountable(g) {
		t.Fatal("winner counts")
	}
}
