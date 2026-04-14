# Repository root for recipes (run from here, or: make -C /path/to/caught-looking dev).
PROJECT_ROOT := $(CURDIR)

.PHONY: dev backend frontend install

## dev: run API (:8080) and Vite dev server together (one terminal)
dev:
	@$(MAKE) --no-print-directory -j2 backend frontend

## backend: Go API only
backend:
	cd "$(PROJECT_ROOT)/backend" && go run .

## frontend: Vite only (proxies /api to 127.0.0.1:8080)
frontend:
	cd "$(PROJECT_ROOT)/frontend" && npm run dev

## install: install Go and npm dependencies
install:
	cd "$(PROJECT_ROOT)/backend" && go mod download
	cd "$(PROJECT_ROOT)/frontend" && npm install
