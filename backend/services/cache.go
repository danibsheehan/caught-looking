package services

import (
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
