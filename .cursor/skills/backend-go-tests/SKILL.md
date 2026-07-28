---
name: backend-go-tests
description: >-
  Writes or updates Go HTTP handler and service tests for caught-looking’s backend
  using httptest MLB fakes, chi routing, and shared test helpers. Use when adding or
  changing code under backend/, writing *_test.go, fixing handler tests, handler
  coverage, MLB test fixtures, cache/client unit tests, or when the user mentions
  backend tests or go test.
---

# Backend Go tests (caught-looking)

## When this applies

- Editing `backend/handlers/`, `backend/services/`, `backend/middleware/`, `backend/config/`, or `backend/main.go` / `router.go` behavior.
- Adding or refactoring `*_test.go` under `backend/`.

## Conventions (must follow)

1. **Package**
   - Handlers: use **`package handlers`** in `handlers/*_test.go` so tests can match production types and (when needed) exercise the same patterns as existing files (e.g. unexported helpers only where tests already do).
   - Services/config/middleware: **`package services`**, **`package config`**, **`package middleware`** — mirror the package under test.

2. **Shared helpers** (do not duplicate ad hoc)
   - Use **`handlers/setup_test.go`**: `testConfig()` and **`newTestHandlers(t, mlbHTTPHandler)`** which wires `config.Config`, `services.NewTTLCache()`, and `services.NewMLBClient(httptest.Server.URL, 0)` (no upstream QPS limit in tests).
   - Fake MLB is always an **`httptest.Server`** (or `http.HandlerFunc`) whose paths and query strings match what **`services.MLBClient.Get`** receives (e.g. `/people/123/stats?stats=season&...`, `/schedule?teamId=...`, `/game/555/linescore`).

3. **Chi routes**
   - If the handler uses **`chi.URLParam`** (`gamePk`, `teamID`, `playerID`, etc.), register the **same path pattern** as in `main.go` / `router.go` on a **`chi.NewRouter()`**, then `ServeHTTP` with `httptest.NewRecorder` and `httptest.NewRequest`.
   - Handlers that only use **query strings** may call the handler directly with `httptest` (see existing `Standings` tests) or mount on chi — stay consistent with neighboring tests in the same file.

4. **What each handler test should cover (minimum)**
   - **Validation**: table-driven **`http.StatusBadRequest`** cases (bad ids, missing required query params, invalid season, etc.).
   - **Success**: **`http.StatusOK`**, `Content-Type` JSON where applicable, **`json.NewDecoder` into `models.*`** and assert key fields.
   - **Upstream failure**: MLB returns non-2xx → expect **`http.StatusBadGateway`** (or whatever the handler returns today). No real network calls.

5. **MLB response bodies**
   - Use **minimal valid JSON** shaped like the real API: `stats` → `splits`, `schedule` → `dates` → `games`, etc. Reuse strings from an existing test in the same area when possible (e.g. `scheduleOneFinalGame` for timelines).

6. **Services (cache / clients)**
   - Prefer table-driven unit tests next to the package (`cache_test.go`, `mlb_client_test.go`, `savant_client_test.go`).
   - Exercise **`GetOrLoad`** coalescing and error paths without a real network; use short TTLs and controlled clocks where neighboring tests already do.

7. **OpenAPI**
   - If the change under test alters **routes, query params, or JSON** the API exposes, update **`backend/apidocs/openapi.yaml`** in the same PR and run **`make check-openapi`** — see **`.cursor/skills/openapi-maintain/SKILL.md`**.

8. **Commands**
   - **Task done**: focused tests for packages you changed (`cd backend && go test ./handlers -count=1`, or `go test ./... -count=1`). Prefer **`make test-backend`** when you want vet + govulncheck + full suite without the coverage gate.
   - When debugging flakes or CI race failures: `go test ./... -race` in `backend/`.
   - **PR done**: **`make ci-local`** / **`.cursor/skills/pr-ready/SKILL.md`** — do not treat full CI as required for every test edit.

## Anti-patterns

- Building `Handlers` by hand in every test instead of `newTestHandlers`.
- Hitting real `statsapi.mlb.com` in unit tests.
- Skipping chi for handlers that use `chi.URLParam` (easy to get false greens).

## Reference locations

- Router wiring: `backend/router.go`, `backend/main.go`.
- Example handler tests: `backend/handlers/*_test.go` (e.g. `players_compare_test.go`, `standings_test.go`, `setup_test.go`).
- MLB client contract: `backend/services/mlb_client.go`.
- Cache: `backend/services/cache.go`, `cache_test.go`.
