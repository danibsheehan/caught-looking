package services

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewSavantClient_trimsTrailingSlash(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("csv"))
	}))
	t.Cleanup(srv.Close)

	c := NewSavantClient(srv.URL+"/", 0, 0)
	body, err := c.Get(context.Background(), "/x")
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "csv" {
		t.Fatalf("got %q want csv", body)
	}
}

func TestSavantClient_Get_success(t *testing.T) {
	const wantBody = "col1,col2\n1,2\n"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method: got %s want GET", r.Method)
		}
		if r.Header.Get("Accept") != "text/csv,*/*;q=0.8" {
			t.Errorf("Accept: got %q", r.Header.Get("Accept"))
		}
		if r.Header.Get("User-Agent") != savantUserAgent {
			t.Errorf("User-Agent: got %q want %q", r.Header.Get("User-Agent"), savantUserAgent)
		}
		if r.URL.Path != "/statcast/csv" || r.URL.RawQuery != "game_pk=1" {
			t.Errorf("URL: got path=%q query=%q", r.URL.Path, r.URL.RawQuery)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(wantBody))
	}))
	t.Cleanup(srv.Close)

	c := NewSavantClient(srv.URL, 0, 0)
	got, err := c.Get(context.Background(), "/statcast/csv?game_pk=1")
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != wantBody {
		t.Fatalf("body: got %q want %q", got, wantBody)
	}
}

func TestSavantClient_Get_errorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`busy`))
	}))
	t.Cleanup(srv.Close)

	c := NewSavantClient(srv.URL, 0, 0)
	_, err := c.Get(context.Background(), "/csv")
	if err == nil {
		t.Fatal("expected error for non-2xx")
	}
	if !strings.Contains(err.Error(), "/csv") || !strings.Contains(err.Error(), "503") {
		t.Fatalf("error should mention path and status: %v", err)
	}
	if !strings.Contains(err.Error(), "busy") {
		t.Fatalf("error should include body snippet: %v", err)
	}
}

func TestSavantClient_Get_errorBodyTruncated(t *testing.T) {
	long := strings.Repeat("z", 250)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(long))
	}))
	t.Cleanup(srv.Close)

	c := NewSavantClient(srv.URL, 0, 0)
	_, err := c.Get(context.Background(), "/bad")
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

func TestSavantClient_Get_invalidPath(t *testing.T) {
	c := NewSavantClient("http://127.0.0.1:9", 0, 0)

	tests := []struct {
		name string
		path string
	}{
		{"empty", ""},
		{"no slash", "statcast/csv"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.Get(context.Background(), tt.path)
			if err == nil {
				t.Fatal("expected error")
			}
			if !strings.Contains(err.Error(), "savant path must start with") {
				t.Fatalf("got %v", err)
			}
		})
	}
}

func TestSavantClient_Get_contextCancelDuringRequest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	t.Cleanup(srv.Close)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	c := NewSavantClient(srv.URL, 0, 0)
	_, err := c.Get(ctx, "/slow")
	if err == nil {
		t.Fatal("expected error from cancelled context")
	}
}

type errReader struct{ err error }

func (e errReader) Read(p []byte) (n int, err error) {
	return 0, e.err
}

func TestSavantClient_Get_readBodyError(t *testing.T) {
	c := &SavantClient{
		baseURL: "http://example.invalid",
		httpClient: &http.Client{
			Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode:    http.StatusOK,
					ContentLength: -1,
					Body:          io.NopCloser(errReader{err: errors.New("simulated read error")}),
					Header:        make(http.Header),
				}, nil
			}),
		},
	}
	_, err := c.Get(context.Background(), "/statcast/csv")
	if err == nil || err.Error() != "simulated read error" {
		t.Fatalf("got err=%v want simulated read error", err)
	}
}

func TestSavantClient_Get_withRateLimiter(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	t.Cleanup(srv.Close)

	c := NewSavantClient(srv.URL, 500, 0)
	body, err := c.Get(context.Background(), "/x")
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "ok" {
		t.Fatalf("body: got %q", body)
	}
}

func TestSavantClient_Get_rateLimiterWaitCanceled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	t.Cleanup(srv.Close)

	// Burst is 2; exhaust tokens with two successful GETs, then the third blocks on Wait until ctx is canceled.
	c := NewSavantClient(srv.URL, 1e-9, 0)
	for i := 0; i < 2; i++ {
		if _, err := c.Get(context.Background(), "/warm"); err != nil {
			t.Fatalf("warm %d: %v", i, err)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(30 * time.Millisecond)
		cancel()
	}()
	_, err := c.Get(ctx, "/blocked")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("got %v want context.Canceled", err)
	}
}

func TestSavantClient_Get_retries503(t *testing.T) {
	var n atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if n.Add(1) == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte("busy"))
			return
		}
		_, _ = w.Write([]byte("csv"))
	}))
	t.Cleanup(srv.Close)

	c := NewSavantClient(srv.URL, 0, 0)
	body, err := c.Get(context.Background(), "/csv")
	if err != nil {
		t.Fatal(err)
	}
	if n.Load() != 2 {
		t.Fatalf("hits: got %d want 2", n.Load())
	}
	if string(body) != "csv" {
		t.Fatalf("body: %q", body)
	}
}
