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
		{name: "liveCeiling", ttl: 60 * time.Second, want: "public, max-age=60"},
		{
			name: "scores",
			ttl:  5 * time.Minute,
			want: "public, max-age=300, stale-while-revalidate=300, stale-if-error=600",
		},
		{
			name: "standings",
			ttl:  time.Hour,
			want: "public, max-age=3600, stale-while-revalidate=3600, stale-if-error=7200",
		},
		{
			name: "statcast",
			ttl:  6 * time.Hour,
			want: "public, max-age=21600, stale-while-revalidate=21600, stale-if-error=43200",
		},
		{
			name: "sieCappedAtDay",
			ttl:  24 * time.Hour,
			want: "public, max-age=86400, stale-while-revalidate=86400, stale-if-error=86400",
		},
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

func TestWriteJSONBytes_setsSWRForSettledTTL(t *testing.T) {
	t.Parallel()
	rec := httptest.NewRecorder()
	writeJSONBytes(rec, []byte(`{"ok":true}`), time.Hour)
	want := "public, max-age=3600, stale-while-revalidate=3600, stale-if-error=7200"
	if got := rec.Header().Get("Cache-Control"); got != want {
		t.Fatalf("Cache-Control: %q want %q", got, want)
	}
}
