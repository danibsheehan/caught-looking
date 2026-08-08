package handlers

import (
	"testing"

	"caught-looking/backend/config"
	"caught-looking/backend/services"
)

func TestHandlers_Ready(t *testing.T) {
	t.Parallel()
	cfg := config.Config{}
	cache := services.NewTTLCache()
	mlb := services.NewMLBClient("http://127.0.0.1:9", 0, 0)
	savant := services.NewSavantClient("http://127.0.0.1:9", 0, 0)

	h := New(cfg, cache, mlb, savant)
	if !h.Ready() {
		t.Fatal("expected fully wired Handlers to be ready")
	}

	var nilH *Handlers
	if nilH.Ready() {
		t.Fatal("nil Handlers must not be ready")
	}
	if New(cfg, nil, mlb, savant).Ready() {
		t.Fatal("missing cache must not be ready")
	}
	if New(cfg, cache, nil, savant).Ready() {
		t.Fatal("missing mlb client must not be ready")
	}
	if New(cfg, cache, mlb, nil).Ready() {
		t.Fatal("missing savant client must not be ready")
	}
}
