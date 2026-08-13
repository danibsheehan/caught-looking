package e2eupstream

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandler_health(t *testing.T) {
	srv := httptest.NewServer(Handler())
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status %d", res.StatusCode)
	}
	body, _ := io.ReadAll(res.Body)
	if string(body) != "ok" {
		t.Fatalf("body %q", body)
	}
}

func TestHandler_contractPaths(t *testing.T) {
	srv := httptest.NewServer(Handler())
	t.Cleanup(srv.Close)

	cases := []struct {
		path       string
		wantSubstr string
		ctype      string
	}{
		{"/standings", `"teamRecords"`, "application/json"},
		{"/divisions", `"NL East"`, "application/json"},
		{"/teams", `"AWY"`, "application/json"},
		{"/schedule?sportId=1&date=" + ContractDate, `"gamePk": ` + ContractGamePk, "application/json"},
		{"/schedule?sportId=1&gamePks=" + ContractGamePk, `"Fixture Park"`, "application/json"},
		{"/schedule?sportId=1&season=2026&teamId=121&gameType=R", `"isWinner"`, "application/json"},
		{"/game/" + ContractGamePk + "/boxscore", `"Away Batter"`, "application/json"},
		{"/game/" + ContractGamePk + "/linescore", `"detailedState"`, "application/json"},
		{"/statcast_search/csv?all=true&type=details&game_pk=" + ContractGamePk, "launch_speed", "text/csv"},
	}

	for _, tc := range cases {
		res, err := http.Get(srv.URL + tc.path)
		if err != nil {
			t.Fatalf("%s: %v", tc.path, err)
		}
		body, _ := io.ReadAll(res.Body)
		_ = res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("%s: status %d body %s", tc.path, res.StatusCode, body)
		}
		if ct := res.Header.Get("Content-Type"); !strings.Contains(ct, tc.ctype) {
			t.Fatalf("%s: Content-Type %q want substring %q", tc.path, ct, tc.ctype)
		}
		if !strings.Contains(string(body), tc.wantSubstr) {
			t.Fatalf("%s: body missing %q: %s", tc.path, tc.wantSubstr, body)
		}
	}
}

func TestHandler_unknown404(t *testing.T) {
	srv := httptest.NewServer(Handler())
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/nope")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("status %d", res.StatusCode)
	}
}
