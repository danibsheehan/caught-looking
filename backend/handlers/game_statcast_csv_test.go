package handlers

import (
	"fmt"
	"math"
	"testing"

	"caught-looking/backend/models"
)

func Test_normalizeInningTopBot(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"", ""},
		{"top", "Top"},
		{"Top", "Top"},
		{"TOP", "Top"},
		{"bottom", "Bottom"},
		{"Bot", "Bottom"},
		{"BOT", "Bottom"},
		{"Middle", "Middle"},
		{"Unknown", "Unknown"},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("%q", tt.in), func(t *testing.T) {
			if got := normalizeInningTopBot(tt.in); got != tt.want {
				t.Fatalf("normalizeInningTopBot(%q) = %q want %q", tt.in, got, tt.want)
			}
		})
	}
}

func Test_normalizeBatterStand(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"", ""},
		{"l", "L"},
		{"L", "L"},
		{"r", "R"},
		{"R", "R"},
		{"s", "S"},
		{"S", "S"},
		{"bats right", ""},
		{"?", ""},
		{"Left", ""},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("%q", tt.in), func(t *testing.T) {
			if got := normalizeBatterStand(tt.in); got != tt.want {
				t.Fatalf("normalizeBatterStand(%q) = %q want %q", tt.in, got, tt.want)
			}
		})
	}
}

func Test_parseCSVFloat(t *testing.T) {
	rec := []string{"  95.1  ", "null", "", "x", "1e2"}
	tests := []struct {
		i       int
		want    float64
		wantOK bool
	}{
		{0, 95.1, true},
		{1, 0, false},
		{2, 0, false},
		{3, 0, false},
		{4, 100, true},
		{-1, 0, false},
		{99, 0, false},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("idx_%d", tt.i), func(t *testing.T) {
			got, ok := parseCSVFloat(rec, tt.i)
			if ok != tt.wantOK || (tt.wantOK && math.Abs(got-tt.want) > 1e-9) {
				t.Fatalf("parseCSVFloat(rec, %d) = (%v, %v) want (%v, %v)", tt.i, got, ok, tt.want, tt.wantOK)
			}
		})
	}
	if got, ok := parseCSVFloat(rec, 1); ok || got != 0 {
		t.Fatalf("EqualFold null: got (%v,%v)", got, ok)
	}
	// NUL string variant
	rec2 := []string{"NULL"}
	got, ok := parseCSVFloat(rec2, 0)
	if ok {
		t.Fatalf("NULL: got ok=true")
	}
	if got != 0 {
		t.Fatalf("NULL: got %v", got)
	}
}

func Test_parseCSVInt(t *testing.T) {
	rec := []string{" 12345 ", "", "notint", "0"}
	tests := []struct {
		i    int
		want int
	}{
		{0, 12345},
		{1, 0},
		{2, 0},
		{3, 0},
		{-1, 0},
		{10, 0},
	}
	for _, tt := range tests {
		if got := parseCSVInt(rec, tt.i); got != tt.want {
			t.Fatalf("parseCSVInt(rec, %d) = %d want %d", tt.i, got, tt.want)
		}
	}
}

func Test_parseStatcastBattedBallsCSV_stripsBOM(t *testing.T) {
	csv := "\xef\xbb\xbflaunch_speed,launch_angle\n91.0,10.0\n"
	got := parseStatcastBattedBallsCSV([]byte(csv))
	if len(got) != 1 {
		t.Fatalf("rows: %d", len(got))
	}
	if got[0].LaunchSpeed == nil || *got[0].LaunchSpeed != 91 || got[0].LaunchAngle == nil || *got[0].LaunchAngle != 10 {
		t.Fatalf("row: %+v", got[0])
	}
}

func Test_parseStatcastBattedBallsCSV_missingRequiredColumns(t *testing.T) {
	tests := []struct {
		name string
		raw  string
	}{
		{"no launch_speed", "launch_angle,batter\n10.0,1\n"},
		{"no launch_angle", "launch_speed,batter\n91.0,1\n"},
		{"empty header line", "\n"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseStatcastBattedBallsCSV([]byte(tt.raw))
			if len(got) != 0 {
				t.Fatalf("want 0 rows, got %d", len(got))
			}
		})
	}
}

func Test_parseStatcastBattedBallsCSV_skipsShortAndBadRows(t *testing.T) {
	csv := `launch_speed,launch_angle,batter,pitcher,player_name,events,inning_topbot,hc_x,hc_y
91,x,1,2,A,hit,top,,
,10,1,2,B,hit,bot,,
91,,1,2,C,hit,Bot,,
bad,10,1,2,D,hit,Bottom,,
91,10,1,2,E,hit,  BOT  ,1.5,2.5
`
	got := parseStatcastBattedBallsCSV([]byte(csv))
	if len(got) != 1 {
		t.Fatalf("want 1 row (last good), got %d: %+v", len(got), got)
	}
	if got[0].PlayerName != "E" {
		t.Fatalf("player: %q", got[0].PlayerName)
	}
	if got[0].InningHalf != "Bottom" {
		t.Fatalf("half: %q", got[0].InningHalf)
	}
	if got[0].HCX == nil || *got[0].HCX != 1.5 || got[0].HCY == nil || *got[0].HCY != 2.5 {
		t.Fatalf("coords: hcx=%v hcy=%v", got[0].HCX, got[0].HCY)
	}
}

func Test_parseStatcastBattedBallsCSV_optionalColumnsOmitted(t *testing.T) {
	csv := `launch_speed,launch_angle
88.5,-3.2
`
	got := parseStatcastBattedBallsCSV([]byte(csv))
	if len(got) != 1 {
		t.Fatalf("rows: %d", len(got))
	}
	if got[0].PlayerName != "" || got[0].Events != "" || got[0].InningHalf != "" {
		t.Fatalf("optional fields should be empty: %+v", got[0])
	}
	if got[0].Batter != 0 || got[0].Pitcher != 0 {
		t.Fatalf("ids: %+v", got[0])
	}
}

func Test_parseStatcastBattedBallsCSV_whitespaceHeaderKeys(t *testing.T) {
	csv := " launch_speed , launch_angle , inning_topbot \n90.0,5.0,bottom\n"
	got := parseStatcastBattedBallsCSV([]byte(csv))
	if len(got) != 1 || got[0].InningHalf != "Bottom" {
		t.Fatalf("got %+v", got)
	}
}

func Test_parseStatcastBattedBallsCSV_extraSavantColumns(t *testing.T) {
	// encoding/csv locks field count to the header row; Savant rows match that width.
	// Extra trailing columns appear in the header so each row has the same arity.
	csv := "launch_speed,launch_angle,batter,pitcher,player_name\n92.0,15.0,100,200,Wide Row\n"
	got := parseStatcastBattedBallsCSV([]byte(csv))
	if len(got) != 1 {
		t.Fatalf("rows: %d", len(got))
	}
	if got[0].Batter != 100 || got[0].Pitcher != 200 || got[0].PlayerName != "Wide Row" {
		t.Fatalf("row: %+v", got[0])
	}
}

func Test_parseStatcastBattedBallsCSV_hcPartialPresent(t *testing.T) {
	csv := "launch_speed,launch_angle,hc_x\n99.0,20.0,10.0\n"
	got := parseStatcastBattedBallsCSV([]byte(csv))
	if len(got) != 1 {
		t.Fatal(len(got))
	}
	if got[0].HCX == nil || *got[0].HCX != 10 || got[0].HCY != nil {
		t.Fatalf("hc: x=%v y=%v", got[0].HCX, got[0].HCY)
	}
}

func Test_parseStatcastBattedBallsCSV_hcInvalidSkipped(t *testing.T) {
	csv := "launch_speed,launch_angle,hc_x,hc_y\n99.0,20.0,nope,30.0\n"
	got := parseStatcastBattedBallsCSV([]byte(csv))
	if len(got) != 1 {
		t.Fatal(len(got))
	}
	if got[0].HCX != nil {
		t.Fatalf("expected invalid hc_x skipped, got %v", got[0].HCX)
	}
	if got[0].HCY == nil || *got[0].HCY != 30 {
		t.Fatalf("hc_y: %+v", got[0].HCY)
	}
}

func Test_parseStatcastBattedBallsCSV_preservesPointerFields(t *testing.T) {
	csv := "launch_speed,launch_angle\n-1.0,45.0\n"
	got := parseStatcastBattedBallsCSV([]byte(csv))
	if len(got) != 1 {
		t.Fatal(len(got))
	}
	// Negative launch speed is still a valid float; ensures we keep pointers distinct.
	if got[0].LaunchSpeed == nil || *got[0].LaunchSpeed != -1 {
		t.Fatalf("ls: %+v", got[0].LaunchSpeed)
	}
	var _ models.StatcastBattedBall = got[0]
}
