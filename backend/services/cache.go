package services

import (
	"context"
	"sync"
	"time"
)

type cacheEntry struct {
	body      []byte
	expiresAt time.Time
}

// TTLCache is a concurrent string-keyed cache with per-entry TTL.
type TTLCache struct {
	m sync.Map // string -> cacheEntry
}

func NewTTLCache() *TTLCache {
	return &TTLCache{}
}

// Get returns cached JSON bytes if present and not expired.
func (c *TTLCache) Get(key string) ([]byte, bool) {
	v, ok := c.m.Load(key)
	if !ok {
		return nil, false
	}
	e := v.(cacheEntry)
	if time.Now().After(e.expiresAt) {
		c.m.Delete(key)
		return nil, false
	}
	return e.body, true
}

// Set stores JSON bytes with the given TTL.
func (c *TTLCache) Set(key string, body []byte, ttl time.Duration) {
	c.m.Store(key, cacheEntry{body: body, expiresAt: time.Now().Add(ttl)})
}

// Len returns the number of keys in the map (including expired entries not yet swept).
func (c *TTLCache) Len() int {
	n := 0
	c.m.Range(func(_, _ any) bool {
		n++
		return true
	})
	return n
}

// SweepExpired deletes all entries whose TTL has passed as of now.
// Returns how many entries were removed.
func (c *TTLCache) SweepExpired(now time.Time) int {
	var stale []string
	c.m.Range(func(key, value any) bool {
		e := value.(cacheEntry)
		if now.After(e.expiresAt) {
			stale = append(stale, key.(string))
		}
		return true
	})
	for _, k := range stale {
		c.m.Delete(k)
	}
	return len(stale)
}

// evictDownTo deletes arbitrary not-yet-expired keys until at most target entries remain.
// Keys are chosen in sync.Map iteration order (undefined). Returns how many entries removed.
func (c *TTLCache) evictDownTo(now time.Time, target int) int {
	if target < 1 {
		target = 1
	}
	var live []string
	c.m.Range(func(key, value any) bool {
		e := value.(cacheEntry)
		if !now.After(e.expiresAt) {
			live = append(live, key.(string))
		}
		return true
	})
	if len(live) <= target {
		return 0
	}
	remove := len(live) - target
	removed := 0
	for i := 0; i < remove; i++ {
		c.m.Delete(live[i])
		removed++
	}
	return removed
}

// SweepAndCap runs SweepExpired, then if maxEntries > 0 and more than maxEntries keys remain,
// evicts live entries down to 90% of maxEntries to reduce churn. Returns (expiredRemoved, capEvicted).
func (c *TTLCache) SweepAndCap(now time.Time, maxEntries int) (expiredRemoved, capEvicted int) {
	expiredRemoved = c.SweepExpired(now)
	if maxEntries <= 0 {
		return expiredRemoved, 0
	}
	target := maxEntries * 9 / 10
	if target < 1 {
		target = 1
	}
	capEvicted = c.evictDownTo(now, target)
	return expiredRemoved, capEvicted
}

// RunSweeper calls SweepAndCap on interval until ctx is cancelled.
func (c *TTLCache) RunSweeper(ctx context.Context, interval time.Duration, maxEntries int, logf func(format string, args ...any)) {
	if interval <= 0 {
		return
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case tick := <-t.C:
			exp, capEv := c.SweepAndCap(tick, maxEntries)
			if logf != nil && (exp > 0 || capEv > 0) {
				logf("cache sweep at %s: removed %d expired, %d size-cap evictions (max_entries=%d)", tick.UTC().Format(time.RFC3339), exp, capEv, maxEntries)
			}
		}
	}
}
