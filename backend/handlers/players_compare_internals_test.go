package handlers

import (
	"math"
	"testing"
)

func Test_yearByYearPlayerStat(t *testing.T) {
	tests := []struct {
		name    string
		group   string
		metric  string
		statMap map[string]interface{}
		want    float64
	}{
		{
			name:    "hitting ops",
			group:   "hitting",
			metric:  "ops",
			statMap: map[string]interface{}{"ops": 0.812},
			want:    0.812,
		},
		{
			name:    "hitting avg string",
			group:   "hitting",
			metric:  "avg",
			statMap: map[string]interface{}{"avg": ".295"},
			want:    0.295,
		},
		{
			name:    "hitting obp slg",
			group:   "hitting",
			metric:  "obp",
			statMap: map[string]interface{}{"obp": 0.38},
			want:    0.38,
		},
		{
			name:    "hitting slg",
			group:   "hitting",
			metric:  "slg",
			statMap: map[string]interface{}{"slg": 0.5},
			want:    0.5,
		},
		{
			name:    "hitting woba primary",
			group:   "hitting",
			metric:  "woba",
			statMap: map[string]interface{}{"woba": 0.36},
			want:    0.36,
		},
		{
			name:   "hitting woba fallback weightedOnBaseAverage",
			group:  "hitting",
			metric: "woba",
			statMap: map[string]interface{}{
				"woba":                    0.0,
				"weightedOnBaseAverage":   0.352,
			},
			want: 0.352,
		},
		{
			name:    "hitting woba both zero",
			group:   "hitting",
			metric:  "woba",
			statMap: map[string]interface{}{"woba": 0.0},
			want:    0,
		},
		{
			name:    "pitching era",
			group:   "pitching",
			metric:  "era",
			statMap: map[string]interface{}{"era": "3.21"},
			want:    3.21,
		},
		{
			name:    "pitching whip k9 bb9 fip",
			group:   "pitching",
			metric:  "whip",
			statMap: map[string]interface{}{"whip": 1.05},
			want:    1.05,
		},
		{
			name:    "pitching k9",
			group:   "pitching",
			metric:  "k9",
			statMap: map[string]interface{}{"strikeoutsPer9Inn": 10.5},
			want:    10.5,
		},
		{
			name:    "pitching bb9",
			group:   "pitching",
			metric:  "bb9",
			statMap: map[string]interface{}{"walksPer9Inn": 2.2},
			want:    2.2,
		},
		{
			name:    "pitching fip",
			group:   "pitching",
			metric:  "fip",
			statMap: map[string]interface{}{"fip": 3.9},
			want:    3.9,
		},
		{
			name:    "unknown group",
			group:   "fielding",
			metric:  "ops",
			statMap: map[string]interface{}{"ops": 1},
			want:    0,
		},
		{
			name:    "unknown metric hitting",
			group:   "hitting",
			metric:  "sb",
			statMap: map[string]interface{}{"stolenBases": 40},
			want:    0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := yearByYearPlayerStat(tt.statMap, tt.group, tt.metric)
			if math.Abs(got-tt.want) > 1e-9 {
				t.Fatalf("got %v want %v", got, tt.want)
			}
		})
	}
}

func Test_fmtSprint(t *testing.T) {
	tests := []struct {
		v    interface{}
		want string
	}{
		{"hello", "hello"},
		{float64(95.1), "95.1"},
		{int(7), "7"},
		{nil, ""},
		{true, ""},
	}
	for _, tt := range tests {
		if got := fmtSprint(tt.v); got != tt.want {
			t.Fatalf("fmtSprint(%v) = %q want %q", tt.v, got, tt.want)
		}
	}
}

func Test_parseBaseballInnings(t *testing.T) {
	tests := []struct {
		in   string
		want float64
	}{
		{"0", 0},
		{"1", 1},
		{"5.0", 5},
		{"5.1", 5 + 1.0/3.0},
		{"5.2", 5 + 2.0/3.0},
		{"182.1", 182 + 1.0/3.0},
		{"  3 ", 3},
		{"not.a.number", 0},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			got := parseBaseballInnings(tt.in)
			if math.Abs(got-tt.want) > 1e-9 {
				t.Fatalf("parseBaseballInnings(%q) = %v want %v", tt.in, got, tt.want)
			}
		})
	}
}

func Test_applyPlayerGroupStats_hitting(t *testing.T) {
	dst := map[string]float64{}
	applyPlayerGroupStats(dst, "hitting", map[string]interface{}{
		"avg":                 ".280",
		"obp":                 0.35,
		"slg":                 0.45,
		"ops":                 0.8,
		"homeRuns":            15,
		"rbi":                 55,
		"runs":                60,
		"hits":                100,
		"doubles":             20,
		"triples":             1,
		"baseOnBalls":         30,
		"strikeouts":        70,
		"stolenBases":         8,
		"plateAppearances":    450,
		"gamesPlayed":         120,
		"weightedOnBaseAverage": 0.34,
	})
	if dst["avg"] != 0.28 || dst["strikeouts"] != 70 {
		t.Fatalf("avg/strikeouts: %+v", dst)
	}
	// Prefer strikeOuts when both exist (MLB JSON shape).
	dst2 := map[string]float64{}
	applyPlayerGroupStats(dst2, "hitting", map[string]interface{}{
		"strikeOuts":  81,
		"strikeouts":  1,
		"gamesPlayed": 1,
	})
	if dst2["strikeouts"] != 81 {
		t.Fatalf("expected strikeOuts to win: got %v", dst2["strikeouts"])
	}
	// woba via weightedOnBaseAverage only
	dst3 := map[string]float64{}
	applyPlayerGroupStats(dst3, "hitting", map[string]interface{}{
		"weightedOnBaseAverage": 0.355,
	})
	if math.Abs(dst3["woba"]-0.355) > 1e-9 {
		t.Fatalf("woba: %+v", dst3)
	}
}

func Test_applyPlayerGroupStats_pitching(t *testing.T) {
	dst := map[string]float64{}
	applyPlayerGroupStats(dst, "pitching", map[string]interface{}{
		"era":                  "2.71",
		"whip":                 1.02,
		"strikeoutsPer9Inn":    9.5,
		"walksPer9Inn":         2.0,
		"inningsPitched":       "182.2",
		"gamesPlayed":          30,
		"wins":                 12,
		"losses":               5,
		"saves":                0,
		"holds":                3,
		"strikeOuts":           200,
		"baseOnBalls":          40,
		"homeRuns":             15,
		"fip":                  3.1,
	})
	if math.Abs(dst["ip"]-(182+2.0/3.0)) > 1e-6 {
		t.Fatalf("ip: got %v", dst["ip"])
	}
	if dst["era"] != 2.71 || dst["wins"] != 12 {
		t.Fatalf("era/wins: %+v", dst)
	}

	dstFloatIP := map[string]float64{}
	applyPlayerGroupStats(dstFloatIP, "pitching", map[string]interface{}{
		"inningsPitched": 27.0,
		"gamesPlayed":    5,
	})
	if math.Abs(dstFloatIP["ip"]-27) > 1e-9 {
		t.Fatalf("float innings: got %v", dstFloatIP["ip"])
	}

	// fmtSprint default skips ip when type is unsupported
	dstSkip := map[string]float64{}
	applyPlayerGroupStats(dstSkip, "pitching", map[string]interface{}{
		"inningsPitched": []int{1},
		"era":            4,
	})
	if _, ok := dstSkip["ip"]; ok {
		t.Fatalf("expected no ip for bad type: %+v", dstSkip)
	}
}
