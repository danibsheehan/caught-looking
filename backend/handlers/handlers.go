package handlers

import (
	"caught-looking/backend/config"
	"caught-looking/backend/services"
)

// Handlers holds shared dependencies for HTTP handlers.
type Handlers struct {
	cfg    config.Config
	cache  *services.TTLCache
	mlb    *services.MLBClient
	savant *services.SavantClient
}

func New(cfg config.Config, cache *services.TTLCache, mlb *services.MLBClient, savant *services.SavantClient) *Handlers {
	return &Handlers{cfg: cfg, cache: cache, mlb: mlb, savant: savant}
}

// Ready reports whether process-local dependencies are wired for serving traffic.
// It does not call MLB or Savant — upstream outages must not fail readiness probes.
func (h *Handlers) Ready() bool {
	return h != nil && h.cache != nil && h.mlb != nil && h.savant != nil
}
