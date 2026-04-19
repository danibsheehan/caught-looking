package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewMLBClient_trimsTrailingSlash(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL + "/")
	body, err := c.Get(context.Background(), "/x")
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "ok" {
		t.Fatalf("got %q want ok", body)
	}
}

func TestMLBClient_Get_success(t *testing.T) {
	const wantBody = `{"teams":[]}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method: got %s want GET", r.Method)
		}
		if r.Header.Get("Accept") != "application/json" {
			t.Errorf("Accept: got %q", r.Header.Get("Accept"))
		}
		if r.Header.Get("User-Agent") != mlbUserAgent {
			t.Errorf("User-Agent: got %q want %q", r.Header.Get("User-Agent"), mlbUserAgent)
		}
		if r.URL.Path != "/api/v1/teams" {
			t.Errorf("path: got %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(wantBody))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL)
	got, err := c.Get(context.Background(), "/api/v1/teams")
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != wantBody {
		t.Fatalf("body: got %q want %q", got, wantBody)
	}
}

func TestMLBClient_Get_errorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`not found`))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL)
	_, err := c.Get(context.Background(), "/missing")
	if err == nil {
		t.Fatal("expected error for non-2xx")
	}
	if !strings.Contains(err.Error(), "/missing") || !strings.Contains(err.Error(), "404") {
		t.Fatalf("error should mention path and status: %v", err)
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("error should include body snippet: %v", err)
	}
}

func TestMLBClient_Get_errorBodyTruncated(t *testing.T) {
	long := strings.Repeat("x", 250)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(long))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL)
	_, err := c.Get(context.Background(), "/err")
	if err == nil {
		t.Fatal("expected error")
	}
	msg := err.Error()
	if strings.Contains(msg, long) {
		t.Fatal("error should truncate long body")
	}
	if !strings.Contains(msg, "…") {
		t.Fatalf("expected ellipsis in truncated message: %v", err)
	}
}

func TestMLBClient_Get_invalidPath(t *testing.T) {
	c := NewMLBClient("http://127.0.0.1:9")

	tests := []struct {
		name string
		path string
	}{
		{"empty", ""},
		{"no slash", "api/v1"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.Get(context.Background(), tt.path)
			if err == nil {
				t.Fatal("expected error")
			}
			if !strings.Contains(err.Error(), "mlb path must start with") {
				t.Fatalf("got %v", err)
			}
		})
	}
}

func TestMLBClient_Get_contextCancel(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	t.Cleanup(srv.Close)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	c := NewMLBClient(srv.URL)
	_, err := c.Get(ctx, "/slow")
	if err == nil {
		t.Fatal("expected error from cancelled context")
	}
}
