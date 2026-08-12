# Repository root for recipes (run from here, or: make -C /path/to/caught-looking dev).
PROJECT_ROOT := $(CURDIR)
COVERAGE_MIN ?= 0.50
CHECK_COVERAGE := python3 "$(PROJECT_ROOT)/.github/scripts/check_cobertura_line_rate.py"

.PHONY: dev backend frontend install check-openapi check-stack-docs check-skills-docs test-backend test-backend-race test-frontend test-e2e test-e2e-contract test-e2e-chaos load-smoke cover-backend cover-backend-html cover-frontend ci-local ci-local-frontend ci-local-backend

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

## check-stack-docs: verify README / project-stack versions match package.json, go.mod, .nvmrc, CI
check-stack-docs:
	python3 "$(PROJECT_ROOT)/.github/scripts/check_stack_docs.py"

## check-skills-docs: verify .cursor/skills/*/SKILL.md matches project-stack.mdc + AGENTS.md listings
check-skills-docs:
	python3 "$(PROJECT_ROOT)/.github/scripts/check_skills_docs.py"

## test-backend: run backend CI checks (vet, govulncheck, tests, build)
test-backend:
	cd "$(PROJECT_ROOT)/backend" && go vet ./...
	cd "$(PROJECT_ROOT)/backend" && go run golang.org/x/vuln/cmd/govulncheck@latest ./...
	cd "$(PROJECT_ROOT)/backend" && go test ./... -count=1
	cd "$(PROJECT_ROOT)/backend" && go build -o /dev/null .

## test-backend-race: run backend tests with the race detector
test-backend-race:
	cd "$(PROJECT_ROOT)/backend" && go test ./... -race -count=1

## test-frontend: run Vitest once (frontend/)
test-frontend:
	cd "$(PROJECT_ROOT)/frontend" && npm run test:run

## test-e2e: Playwright Chromium smoke (build + preview; stubbed /api)
test-e2e:
	cd "$(PROJECT_ROOT)/frontend" && npm run test:e2e

## test-e2e-contract: Playwright against real Go API + fixture MLB/Savant (no live upstream)
test-e2e-contract:
	cd "$(PROJECT_ROOT)/frontend" && npm run test:e2e:contract

## test-e2e-chaos: Playwright degradation path (fixture upstream 429/5xx/slow via /_chaos)
test-e2e-chaos:
	cd "$(PROJECT_ROOT)/frontend" && npm run test:e2e:chaos

## load-smoke: prove cache singleflight under concurrency (fixture upstream + /metrics asserts)
load-smoke:
	bash "$(PROJECT_ROOT)/scripts/load-smoke.sh"

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

## ci-local-backend: backend job parity (vet, govulncheck, race, coverage gate, build)
ci-local-backend:
	cd "$(PROJECT_ROOT)/backend" && go vet ./...
	cd "$(PROJECT_ROOT)/backend" && go run golang.org/x/vuln/cmd/govulncheck@latest ./...
	cd "$(PROJECT_ROOT)/backend" && go test ./... -race -count=1
	cd "$(PROJECT_ROOT)/backend" && go test ./... -count=1 -coverprofile=coverage.out -covermode=atomic
	cd "$(PROJECT_ROOT)/backend" && go install github.com/boumenot/gocover-cobertura@v1.4.0
	cd "$(PROJECT_ROOT)/backend" && "$$(go env GOPATH)/bin/gocover-cobertura" < coverage.out > gha-cobertura-raw.xml
	python3 "$(PROJECT_ROOT)/.github/scripts/merge_cobertura_by_file.py" "$(PROJECT_ROOT)/backend/gha-cobertura-raw.xml" > "$(PROJECT_ROOT)/gha-cobertura.xml"
	$(CHECK_COVERAGE) "$(PROJECT_ROOT)/gha-cobertura.xml" $(COVERAGE_MIN) --label "Backend coverage"
	cd "$(PROJECT_ROOT)/backend" && go build -o /dev/null .

## ci-local: full local parity with GitHub Actions CI (frontend + backend)
ci-local: check-stack-docs check-skills-docs ci-local-frontend ci-local-backend
