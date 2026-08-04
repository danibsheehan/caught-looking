package services

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestTTLCache_Get_miss(t *testing.T) {
	c := NewTTLCache()
	if _, ok := c.Get("k"); ok {
		t.Fatal("expected miss on empty cache")
	}
}

func TestTTLCache_SetGet_hit(t *testing.T) {
	c := NewTTLCache()
	want := []byte(`{"x":1}`)
	c.Set("k", want, time.Hour)

	got, ok := c.Get("k")
	if !ok {
		t.Fatal("expected hit")
	}
	if string(got) != string(want) {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestTTLCache_Get_expired(t *testing.T) {
	c := NewTTLCache()
	c.Set("k", []byte("gone"), 25*time.Millisecond)

	if _, ok := c.Get("k"); !ok {
		t.Fatal("expected hit before expiry")
	}

	time.Sleep(50 * time.Millisecond)

	if _, ok := c.Get("k"); ok {
		t.Fatal("expected miss after expiry")
	}
	// Second Get on missing/expired key should stay miss
	if _, ok := c.Get("k"); ok {
		t.Fatal("expected miss on cleared key")
	}
}

func TestTTLCache_overwrite(t *testing.T) {
	c := NewTTLCache()
	c.Set("k", []byte("a"), time.Hour)
	c.Set("k", []byte("b"), time.Hour)

	got, ok := c.Get("k")
	if !ok {
		t.Fatal("expected hit")
	}
	if string(got) != "b" {
		t.Fatalf("got %q want %q", got, "b")
	}
}

func TestTTLCache_GetOrLoad_coalesces(t *testing.T) {
	c := NewTTLCache()
	var calls atomic.Int32
	const n = 20
	var wg sync.WaitGroup
	wg.Add(n)
	errCh := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			body, _, err := c.GetOrLoad(context.Background(), "k", time.Hour, func(context.Context) ([]byte, error) {
				calls.Add(1)
				time.Sleep(30 * time.Millisecond)
				return []byte("ok"), nil
			})
			if err != nil {
				errCh <- err
				return
			}
			if string(body) != "ok" {
				errCh <- fmt.Errorf("body %q", body)
			}
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("load calls: got %d want 1", got)
	}
	// Second wave should hit cache without calling load.
	body, rem, err := c.GetOrLoad(context.Background(), "k", time.Hour, func(context.Context) ([]byte, error) {
		calls.Add(1)
		return []byte("nope"), nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "ok" {
		t.Fatalf("got %q", body)
	}
	if rem <= 0 || rem > time.Hour {
		t.Fatalf("remaining ttl out of range: %v", rem)
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("after cache hit load calls: got %d want 1", got)
	}
}

func TestTTLCache_GetOrLoad_error(t *testing.T) {
	c := NewTTLCache()
	_, _, err := c.GetOrLoad(context.Background(), "k", time.Hour, func(context.Context) ([]byte, error) {
		return nil, errors.New("boom")
	})
	if err == nil || err.Error() != "boom" {
		t.Fatalf("err: %v", err)
	}
	if _, ok := c.Get("k"); ok {
		t.Fatal("failed load must not populate cache")
	}
}

func TestTTLCache_GetOrLoadWithTTL_usesLoadTTL(t *testing.T) {
	c := NewTTLCache()
	body, _, err := c.GetOrLoadWithTTL(context.Background(), "k", func(context.Context) ([]byte, time.Duration, error) {
		return []byte("ok"), 40 * time.Millisecond, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "ok" {
		t.Fatalf("body %q", body)
	}
	if _, ok := c.Get("k"); !ok {
		t.Fatal("expected hit before expiry")
	}
	time.Sleep(60 * time.Millisecond)
	if _, ok := c.Get("k"); ok {
		t.Fatal("expected miss after load-chosen TTL")
	}
}
