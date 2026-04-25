package handlers

import (
	"encoding/json"
	"testing"
)

func Test_parseVenueSplitsFromSchedule_homeAndAway(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[
		{"status":{"abstractGameState":"Final","detailedState":"Final"},"isTie":false,
		 "teams":{"away":{"team":{"id":158},"isWinner":false,"score":3},"home":{"team":{"id":121},"isWinner":true,"score":5}}},
		{"status":{"abstractGameState":"Final","detailedState":"Final"},"isTie":false,
		 "teams":{"away":{"team":{"id":121},"isWinner":false,"score":2},"home":{"team":{"id":144},"isWinner":true,"score":4}}}
	]}]}`)

	got, err := parseVenueSplitsFromSchedule(raw, 121)
	if err != nil {
		t.Fatal(err)
	}
	if got.Home.Games != 1 || got.Home.Wins != 1 || got.Home.Losses != 0 || got.Home.RunsScored != 5 || got.Home.RunsAllowed != 3 {
		t.Fatalf("home: %+v", got.Home)
	}
	if got.Away.Games != 1 || got.Away.Wins != 0 || got.Away.Losses != 1 || got.Away.RunsScored != 2 || got.Away.RunsAllowed != 4 {
		t.Fatalf("away: %+v", got.Away)
	}
	if got.Home.RunsPerGame < 4.99 || got.Home.RunsPerGame > 5.01 {
		t.Fatalf("home R/G: %v", got.Home.RunsPerGame)
	}
}

func Test_parseVenueSplitsFromSchedule_skipsPostponedAndNonFinal(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[
		{"status":{"abstractGameState":"Preview","detailedState":"Scheduled"},"isTie":false,
		 "teams":{"away":{"team":{"id":121},"score":null},"home":{"team":{"id":144},"score":null}}},
		{"status":{"abstractGameState":"Final","detailedState":"Postponed"},"isTie":false,
		 "teams":{"away":{"team":{"id":121},"isWinner":false,"score":0},"home":{"team":{"id":144},"isWinner":false,"score":0}}},
		{"status":{"abstractGameState":"Final","detailedState":"Final"},"isTie":false,
		 "teams":{"away":{"team":{"id":121},"isWinner":true,"score":1},"home":{"team":{"id":144},"isWinner":false,"score":0}}}
	]}]}`)

	got, err := parseVenueSplitsFromSchedule(raw, 121)
	if err != nil {
		t.Fatal(err)
	}
	if got.Home.Games != 0 || got.Away.Games != 1 || got.Away.Wins != 1 {
		t.Fatalf("want one away win only, got home=%+v away=%+v", got.Home, got.Away)
	}
}

func Test_parseVenueSplitsFromSchedule_tieNoWinLoss(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[
		{"status":{"abstractGameState":"Final","detailedState":"Final"},"isTie":true,
		 "teams":{"away":{"team":{"id":121},"isWinner":false,"score":3},"home":{"team":{"id":144},"isWinner":false,"score":3}}}
	]}]}`)

	got, err := parseVenueSplitsFromSchedule(raw, 121)
	if err != nil {
		t.Fatal(err)
	}
	if got.Away.Games != 1 || got.Away.Wins != 0 || got.Away.Losses != 0 || got.Away.RunsScored != 3 || got.Away.RunsAllowed != 3 {
		t.Fatalf("away tie: %+v", got.Away)
	}
}

func Test_parseVenueSplitsFromSchedule_invalidJSON(t *testing.T) {
	_, err := parseVenueSplitsFromSchedule([]byte(`not-json`), 121)
	if err == nil {
		t.Fatal("expected error")
	}
}

func Test_parseVenueSplitsFromSchedule_roundTripJSON(t *testing.T) {
	raw := []byte(`{"dates":[{"games":[
		{"status":{"abstractGameState":"Final","detailedState":"Final"},"isTie":false,
		 "teams":{"away":{"team":{"id":121},"isWinner":true,"score":4},"home":{"team":{"id":144},"isWinner":false,"score":2}}}
	]}]}`)
	got, err := parseVenueSplitsFromSchedule(raw, 121)
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	var dec struct {
		Away struct {
			Games int `json:"games"`
		} `json:"away"`
	}
	if err := json.Unmarshal(b, &dec); err != nil {
		t.Fatal(err)
	}
	if dec.Away.Games != 1 {
		t.Fatalf("json: %s", string(b))
	}
}
