package services

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// roundTripperFunc is shared by MLB and Savant client tests in this package.
type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

// mlbTestNetTimeout implements net.Error with Timeout() == true for mlbRetryable tests.
type mlbTestNetTimeout struct{}

func (mlbTestNetTimeout) Error() string   { return "timeout" }
func (mlbTestNetTimeout) Timeout() bool   { return true }
func (mlbTestNetTimeout) Temporary() bool { return false }

func TestNewMLBClient_trimsTrailingSlash(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL+"/", 0, 0)
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

	c := NewMLBClient(srv.URL, 0, 0)
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

	c := NewMLBClient(srv.URL, 0, 0)
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

	c := NewMLBClient(srv.URL, 0, 0)
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
	c := NewMLBClient("http://127.0.0.1:9", 0, 0)

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

	c := NewMLBClient(srv.URL, 0, 0)
	_, err := c.Get(ctx, "/slow")
	if err == nil {
		t.Fatal("expected error from cancelled context")
	}
}

func TestMLBClient_Get_retriesAfterSlowHeaders(t *testing.T) {
	var n atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cur := n.Add(1)
		if cur == 1 {
			time.Sleep(400 * time.Millisecond)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL, 0, 200*time.Millisecond)
	body, err := c.Get(context.Background(), "/x")
	if err != nil {
		t.Fatal(err)
	}
	if n.Load() != 2 {
		t.Fatalf("server invocations: got %d want 2 (retry after header timeout)", n.Load())
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("body: got %s", body)
	}
}

func Test_mlbRetryable(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"canceled", context.Canceled, false},
		{"wrapped canceled", fmt.Errorf("wrap: %w", context.Canceled), false},
		{"deadline exceeded", context.DeadlineExceeded, true},
		{"wrapped deadline", fmt.Errorf("wrap: %w", context.DeadlineExceeded), true},
		{"url wraps deadline", &url.Error{Op: "Get", URL: "http://x", Err: context.DeadlineExceeded}, true},
		{"net timeout", mlbTestNetTimeout{}, true},
		{"client timeout string", errors.New("Get http://x: Client.Timeout exceeded while awaiting headers"), true},
		{"awaiting headers", errors.New(`Get "http://x": net/http: timeout awaiting response headers`), true},
		{"connection reset", errors.New("read tcp: connection reset by peer"), true},
		{"broken pipe", errors.New("write tcp: broken pipe"), true},
		{"tls handshake", errors.New("net/http: TLS handshake timeout"), true},
		{"unexpected EOF", errors.New("unexpected EOF"), true},
		{"closed network", errors.New("use of closed network connection"), true},
		{"generic", errors.New("something else"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := mlbRetryable(tt.err); got != tt.want {
				t.Fatalf("mlbRetryable(%v) = %v want %v", tt.err, got, tt.want)
			}
		})
	}
}

func Test_sleepContext(t *testing.T) {
	t.Run("canceled before wait", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		err := sleepContext(ctx, time.Hour)
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("got %v want context.Canceled", err)
		}
	})
	t.Run("completes", func(t *testing.T) {
		err := sleepContext(context.Background(), 5*time.Millisecond)
		if err != nil {
			t.Fatal(err)
		}
	})
}

func TestMLBClient_Get_doesNotRetryOnContextCanceled(t *testing.T) {
	var n atomic.Int32
	c := NewMLBClient("http://127.0.0.1:9", 0, time.Minute)
	c.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		n.Add(1)
		return nil, context.Canceled
	})

	_, err := c.Get(context.Background(), "/x")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("got %v want context.Canceled", err)
	}
	if n.Load() != 1 {
		t.Fatalf("RoundTrip calls: got %d want 1 (no retry)", n.Load())
	}
}

func TestMLBClient_Get_retriesAfterDeadlineExceededOnDo(t *testing.T) {
	var n atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n.Add(1)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL, 0, time.Minute)
	inner := c.transport
	var rtCalls atomic.Int32
	c.httpClient.Transport = roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		if rtCalls.Add(1) == 1 {
			return nil, context.DeadlineExceeded
		}
		return inner.RoundTrip(req)
	})

	body, err := c.Get(context.Background(), "/y")
	if err != nil {
		t.Fatal(err)
	}
	if n.Load() != 1 {
		t.Fatalf("server hits: got %d want 1", n.Load())
	}
	if rtCalls.Load() != 2 {
		t.Fatalf("RoundTrip calls: got %d want 2", rtCalls.Load())
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("body: got %s", body)
	}
}

func TestMLBClient_Get_sleepContextRespectsCancel(t *testing.T) {
	var n atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cur := n.Add(1)
		if cur == 1 {
			time.Sleep(400 * time.Millisecond)
		}
		_, _ = w.Write([]byte(`ok`))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL, 0, 200*time.Millisecond)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		// With 200ms req timeout, response-header timeout is 100ms, so the first attempt fails ~100ms
		// then sleepContext runs 100ms. Cancel mid-sleep so Get returns before the second attempt.
		time.Sleep(150 * time.Millisecond)
		cancel()
		close(done)
	}()

	_, err := c.Get(ctx, "/x")
	<-done

	if !errors.Is(err, context.Canceled) {
		t.Fatalf("got %v want context.Canceled", err)
	}
}

func TestMLBClient_Get_retriesOnRetryableReadBodyError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"x":1}`))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL, 0, time.Minute)
	inner := c.transport
	var rtCalls atomic.Int32
	c.httpClient.Transport = roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		if rtCalls.Add(1) == 1 {
			return &http.Response{
				StatusCode:    http.StatusOK,
				ContentLength: -1,
				Body:          io.NopCloser(errReader{err: context.DeadlineExceeded}),
				Header:        make(http.Header),
				Request:       req,
			}, nil
		}
		return inner.RoundTrip(req)
	})

	body, err := c.Get(context.Background(), "/z")
	if err != nil {
		t.Fatal(err)
	}
	if rtCalls.Load() != 2 {
		t.Fatalf("RoundTrip calls: got %d want 2", rtCalls.Load())
	}
	if string(body) != `{"x":1}` {
		t.Fatalf("body: got %s", body)
	}
}

func TestMLBClient_Get_bodyTooLarge(t *testing.T) {
	c := NewMLBClient("http://example.invalid", 0, 0)
	c.httpClient.Transport = roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body: io.NopCloser(io.LimitReader(
				&infiniteReader{b: 'z'},
				maxUpstreamBodyBytes+2,
			)),
			Header:  make(http.Header),
			Request: req,
		}, nil
	})
	_, err := c.Get(context.Background(), "/huge")
	if err == nil || !strings.Contains(err.Error(), "exceeds") {
		t.Fatalf("got %v", err)
	}
}

func TestMLBClient_Get_retries429(t *testing.T) {
	var n atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if n.Add(1) == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte("slow down"))
			return
		}
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(srv.Close)

	c := NewMLBClient(srv.URL, 0, 0)
	body, err := c.Get(context.Background(), "/x")
	if err != nil {
		t.Fatal(err)
	}
	if n.Load() != 2 {
		t.Fatalf("hits: got %d want 2", n.Load())
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("body: %s", body)
	}
}

type infiniteReader struct{ b byte }

func (r *infiniteReader) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = r.b
	}
	return len(p), nil
}
