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
}

func New(cfg config.Config, cache *services.TTLCache, mlb *services.MLBClient) *Handlers {
	return &Handlers{cfg: cfg, cache: cache, mlb: mlb}
}
