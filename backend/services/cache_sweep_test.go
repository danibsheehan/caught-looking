package services

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestTTLCache_SweepExpired(t *testing.T) {
	c := NewTTLCache()
	c.Set("live", []byte("1"), time.Hour)
	c.Set("gone", []byte("2"), -time.Minute)

	n := c.SweepExpired(time.Now())
	if n != 1 {
		t.Fatalf("SweepExpired removed %d want 1", n)
	}
	if c.Len() != 1 {
		t.Fatalf("Len after sweep: got %d want 1", c.Len())
	}
	if _, ok := c.Get("live"); !ok {
		t.Fatal("expected live key")
	}
	if _, ok := c.Get("gone"); ok {
		t.Fatal("expected gone key absent")
	}
}

func TestTTLCache_SweepAndCap_evictsLiveWhenOverMax(t *testing.T) {
	c := NewTTLCache()
	for i := 0; i < 15; i++ {
		c.Set(fmt.Sprintf("k%d", i), []byte("x"), time.Hour)
	}
	exp, capEv := c.SweepAndCap(time.Now(), 10)
	if exp != 0 {
		t.Fatalf("expired removed %d want 0", exp)
	}
	if capEv != 6 {
		t.Fatalf("cap evicted %d want 6 (15 down to 9)", capEv)
	}
	if c.Len() != 9 {
		t.Fatalf("Len after cap: got %d want 9", c.Len())
	}
}

func TestTTLCache_RunSweeper_exitsOnCancel(t *testing.T) {
	c := NewTTLCache()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		c.RunSweeper(ctx, time.Millisecond, 0, nil)
		close(done)
	}()
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("RunSweeper did not stop after cancel")
	}
}
