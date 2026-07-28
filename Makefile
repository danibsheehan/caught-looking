# Repository root for recipes (run from here, or: make -C /path/to/caught-looking dev).
PROJECT_ROOT := $(CURDIR)
COVERAGE_MIN ?= 0.50
CHECK_COVERAGE := python3 "$(PROJECT_ROOT)/.github/scripts/check_cobertura_line_rate.py"

.PHONY: dev backend frontend install check-openapi test-backend test-frontend cover-backend cover-backend-html cover-frontend ci-local ci-local-frontend ci-local-backend

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

## check-openapi: lint OpenAPI and ensure generated frontend types are up to date
check-openapi:
	cd "$(PROJECT_ROOT)/frontend" && npm run api:validate
	cd "$(PROJECT_ROOT)/frontend" && npm run api:types:check

## test-backend: run backend CI checks (vet, govulncheck, tests, build)
test-backend:
	cd "$(PROJECT_ROOT)/backend" && go vet ./...
	cd "$(PROJECT_ROOT)/backend" && go run golang.org/x/vuln/cmd/govulncheck@latest ./...
	cd "$(PROJECT_ROOT)/backend" && go test ./... -count=1
	cd "$(PROJECT_ROOT)/backend" && go build -o /dev/null .

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

## ci-local-frontend: frontend job parity (audit, OpenAPI, lint, format, typecheck, coverage gate, build)
ci-local-frontend:
	cd "$(PROJECT_ROOT)/frontend" && npm audit --audit-level=high
	@$(MAKE) --no-print-directory check-openapi
	cd "$(PROJECT_ROOT)/frontend" && npm run lint
	cd "$(PROJECT_ROOT)/frontend" && npm run format:check
	cd "$(PROJECT_ROOT)/frontend" && npm run typecheck
	cd "$(PROJECT_ROOT)/frontend" && npm run test:coverage
	$(CHECK_COVERAGE) "$(PROJECT_ROOT)/frontend/coverage/cobertura-coverage.xml" $(COVERAGE_MIN) --label "Frontend coverage"
	cd "$(PROJECT_ROOT)/frontend" && npm run build

## ci-local-backend: backend job parity (vet, govulncheck, coverage gate, build)
ci-local-backend:
	cd "$(PROJECT_ROOT)/backend" && go vet ./...
	cd "$(PROJECT_ROOT)/backend" && go run golang.org/x/vuln/cmd/govulncheck@latest ./...
	cd "$(PROJECT_ROOT)/backend" && go test ./... -count=1 -coverprofile=coverage.out -covermode=atomic
	cd "$(PROJECT_ROOT)/backend" && go install github.com/boumenot/gocover-cobertura@v1.4.0
	cd "$(PROJECT_ROOT)/backend" && "$$(go env GOPATH)/bin/gocover-cobertura" < coverage.out > gha-cobertura-raw.xml
	python3 "$(PROJECT_ROOT)/.github/scripts/merge_cobertura_by_file.py" "$(PROJECT_ROOT)/backend/gha-cobertura-raw.xml" > "$(PROJECT_ROOT)/gha-cobertura.xml"
	$(CHECK_COVERAGE) "$(PROJECT_ROOT)/gha-cobertura.xml" $(COVERAGE_MIN) --label "Backend coverage"
	cd "$(PROJECT_ROOT)/backend" && go build -o /dev/null .

## ci-local: full local parity with GitHub Actions CI (frontend + backend)
ci-local: ci-local-frontend ci-local-backend
