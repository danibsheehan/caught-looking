package e2eupstream

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestChaos_5xxOnMatchedPath(t *testing.T) {
	c := NewChaos()
	c.Set(ChaosConfig{Mode: Chaos5xx, Paths: []string{"/statcast_search/csv"}})
	srv := httptest.NewServer(NewServer(c).Handler())
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/statcast_search/csv?game_pk=" + ContractGamePk)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusBadGateway {
		t.Fatalf("statcast status: got %d want 502", res.StatusCode)
	}

	// Unmatched path still succeeds.
	res2, err := http.Get(srv.URL + "/game/" + ContractGamePk + "/boxscore")
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		t.Fatalf("boxscore status: got %d want 200", res2.StatusCode)
	}
}

func TestChaos_429(t *testing.T) {
	c := NewChaos()
	c.Set(ChaosConfig{Mode: Chaos429, Paths: []string{"/standings"}})
	srv := httptest.NewServer(NewServer(c).Handler())
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/standings")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status: got %d want 429", res.StatusCode)
	}
	if got := res.Header.Get("Retry-After"); got != "0" {
		t.Fatalf("Retry-After: got %q want 0", got)
	}
}

func TestChaos_slowThenOK(t *testing.T) {
	c := NewChaos()
	c.Set(ChaosConfig{Mode: ChaosSlow, Paths: []string{"/standings"}, SlowMS: 80})
	srv := httptest.NewServer(NewServer(c).Handler())
	t.Cleanup(srv.Close)

	start := time.Now()
	res, err := http.Get(srv.URL + "/standings")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	elapsed := time.Since(start)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d want 200", res.StatusCode)
	}
	if elapsed < 80*time.Millisecond {
		t.Fatalf("expected delay >= 80ms, got %v", elapsed)
	}
}

func TestChaos_controlAPI(t *testing.T) {
	c := NewChaos()
	srv := httptest.NewServer(NewServer(c).Handler())
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/_chaos")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var got ChaosConfig
	if err := json.NewDecoder(res.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got.Mode != ChaosNone {
		t.Fatalf("mode: got %q want none", got.Mode)
	}

	body, _ := json.Marshal(ChaosConfig{Mode: Chaos5xx, Paths: []string{"/teams"}, SlowMS: 2000})
	req, err := http.NewRequest(http.MethodPut, srv.URL+"/_chaos", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	res2, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		t.Fatalf("PUT status %d", res2.StatusCode)
	}

	res3, err := http.Get(srv.URL + "/teams")
	if err != nil {
		t.Fatal(err)
	}
	defer res3.Body.Close()
	if res3.StatusCode != http.StatusBadGateway {
		t.Fatalf("teams under chaos: got %d want 502", res3.StatusCode)
	}

	// /health and /_chaos never chaosed even when paths empty + mode 5xx
	c.Set(ChaosConfig{Mode: Chaos5xx, Paths: nil})
	res4, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer res4.Body.Close()
	body4, _ := io.ReadAll(res4.Body)
	if res4.StatusCode != http.StatusOK || string(body4) != "ok" {
		t.Fatalf("health under global chaos: status %d body %q", res4.StatusCode, body4)
	}
}

func TestChaos_healthAndControlExemptFromEmptyPathMatch(t *testing.T) {
	c := NewChaos()
	c.Set(ChaosConfig{Mode: Chaos5xx}) // empty paths = all fixture paths
	srv := httptest.NewServer(NewServer(c).Handler())
	t.Cleanup(srv.Close)

	res, err := http.Get(srv.URL + "/_chaos")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("/_chaos status %d", res.StatusCode)
	}
	if ct := res.Header.Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Fatalf("content-type %q", ct)
	}
}
