package handlers

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCacheControlForTTL(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		ttl  time.Duration
		want string
	}{
		{name: "zero", ttl: 0, want: "private, no-store"},
		{name: "negative", ttl: -time.Second, want: "private, no-store"},
		{name: "subsecond", ttl: 500 * time.Millisecond, want: "public, max-age=1"},
		{name: "live", ttl: 45 * time.Second, want: "public, max-age=45"},
		{name: "standings", ttl: time.Hour, want: "public, max-age=3600"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := cacheControlForTTL(tc.ttl); got != tc.want {
				t.Fatalf("got %q want %q", got, tc.want)
			}
		})
	}
}

func TestWriteJSONBytes_setsCacheControl(t *testing.T) {
	t.Parallel()
	rec := httptest.NewRecorder()
	writeJSONBytes(rec, []byte(`{"ok":true}`), 45*time.Second)
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type: %q", got)
	}
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=45" {
		t.Fatalf("Cache-Control: %q", got)
	}
	if !strings.Contains(rec.Body.String(), `"ok":true`) {
		t.Fatalf("body: %s", rec.Body.String())
	}
}
