# Repository root for recipes (run from here, or: make -C /path/to/caught-looking dev).
PROJECT_ROOT := $(CURDIR)

.PHONY: dev backend frontend install test-backend test-frontend cover-backend cover-backend-html cover-frontend

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

## test-backend: run all Go unit tests (backend/)
test-backend:
	cd "$(PROJECT_ROOT)/backend" && go test ./... -count=1

## test-frontend: run Vitest once (frontend/)
test-frontend:
	cd "$(PROJECT_ROOT)/frontend" && npm run test:run

## cover-frontend: Vitest with V8 coverage report (frontend/coverage/)
cover-frontend:
	cd "$(PROJECT_ROOT)/frontend" && npm run test:coverage

## cover-backend: run tests with coverage, print per-function % (writes backend/coverage.out)
cover-backend:
	cd "$(PROJECT_ROOT)/backend" && go test ./... -count=1 -coverprofile=coverage.out -covermode=atomic
	cd "$(PROJECT_ROOT)/backend" && go tool cover -func=coverage.out

## cover-backend-html: same as cover-backend, also writes backend/coverage.html for the browser
cover-backend-html: cover-backend
	cd "$(PROJECT_ROOT)/backend" && go tool cover -html=coverage.out -o coverage.html
