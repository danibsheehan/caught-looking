# AGENTS.md

Instructions for any coding agent (Cursor, Claude Code, or otherwise) working in this repo.
Human contributors: see [`README.md`](README.md) and [`docs/`](docs/README.md) instead — this
file is written for agents and skips the narrative tour.

Caught Looking (caught-looking.com) is a read-only MLB stats explorer: standings, season
leaders, team pages, player comparisons, and per-game boards (box score, inning timeline,
Statcast pitch/spray data). No accounts, no writes — a caching proxy + visualization layer
in front of the public MLB Stats API (JSON) and Baseball Savant (CSV).

Stack: Go 1.26 API (`backend/`, chi router) + React 19 / Vite / TypeScript 6 SPA (`frontend/`),
tied together by an OpenAPI contract (`backend/apidocs/openapi.yaml`).

## Install

```bash
make install   # go mod download + npm install
```

Requires the Go version pinned in `backend/go.mod` and the Node version pinned in `.nvmrc`
(check both if a tool isn't on `PATH` correctly — `nvm use` picks up `.nvmrc` automatically).

## Configure

Nothing is required for local dev — every env var has a working default. Full reference:
[`docs/configuration.md`](docs/configuration.md) (upstream URLs, cache TTLs, QPS/rate limits,
`VITE_API_BASE`). Only set `VITE_API_BASE` when pointing the SPA at a non-local API.

## Run

```bash
make dev        # API on :8080 + Vite together, one terminal
make backend    # API only
make frontend   # Vite only (proxies /api -> 127.0.0.1:8080)
```

## Test

```bash
make test-backend        # go vet, govulncheck, go test, build
make test-backend-race   # go test -race
make lint-backend        # golangci-lint (required CI gate on backend/** changes)
make test-frontend       # vitest run
make cover-backend       # coverage.out + per-func %
make cover-frontend      # vitest coverage -> frontend/coverage/
make check-openapi       # Redocly lint + generated-types drift check
make load-smoke          # cache singleflight/coalesce proof under concurrency
```

Optional Playwright e2e (not required for every change): `make test-e2e` (stubbed API),
`make test-e2e-contract` (real Go API + fixture upstream), `make test-e2e-chaos` (429/5xx/slow
fault injection). Coverage gate is ≥50% line rate on both sides, enforced in CI.

Before opening or updating a PR, run full local CI parity:

```bash
make ci-local   # stack-docs + skills-docs drift, then ci-local-frontend + ci-local-backend
```

## Conventions

Detailed, path-scoped conventions live in `.cursor/rules/*.mdc` and are read automatically by
Claude Code via [`CLAUDE.md`](CLAUDE.md); Cursor reads them natively. Do not restate them here —
this section is the map, not the content:

| Area | Rule |
|---|---|
| Repo layout, dev commands, definition of done | `.cursor/rules/project-stack.mdc` |
| Go backend (handlers, models, services, middleware) | `.cursor/rules/backend-go.mdc` |
| React components, hooks, pages | `.cursor/rules/frontend-react.mdc` |
| API client / fetch helpers | `.cursor/rules/frontend-api.mdc` |
| Generated OpenAPI TS types + compat layer | `.cursor/rules/frontend-api-types.mdc` |
| BEM class naming (new components/styles only) | `.cursor/rules/frontend-bem.mdc` |
| Prettier formatting | `.cursor/rules/frontend-prettier.mdc` |
| Vitest / Testing Library conventions | `.cursor/rules/frontend-testing.mdc` |
| OpenAPI contract discipline | `.cursor/rules/openapi-contract.mdc` |
| README accuracy | `.cursor/rules/readme.mdc` |

Step-by-step playbooks (both `.cursor/skills/*/SKILL.md` and `.claude/skills/` — same files,
symlinked, auto-invoked by either tool based on the task):

- `add-api-endpoint` — full route end-to-end: models → handler → router → OpenAPI → types →
  client → hook/UI → tests.
- `backend-go-tests` / `frontend-vitest-tests` — test conventions and fakes.
- `backend-http-security` — CORS, rate limits, body caps, error responses, threat model.
- `caching-and-upstream-perf` — `TTLCache`, `GetOrLoad`, MLB/Savant QPS limits.
- `openapi-maintain` — keeping the spec, generated types, and compat layer in sync.
- `pr-ready` — local CI-parity checks and PR template before opening a PR.
- `pr-summary-draft` — drafts a why-first PR Summary/How-to-verify from the actual diff and
  commits, complementing the path-based PR guide scaffolding (which only knows file paths).
- `doc-sync-patch` — patches README/`project-stack.mdc`/`AGENTS.md` version drift after a
  dependency bump; run when `make check-stack-docs` fails or after bumping React, Vite,
  TypeScript, Go, or CI Node/Go.
- `dependabot-triage` — reads each open Dependabot PR's changelog and required CI to classify
  risk (security / low risk / needs a look); merges only PRs the user explicitly names.
- `adr-doc-sync-check` — flags when a diff changes cache TTL/QPS defaults, CORS/rate-limit/
  body-cap/security-header behavior, or the OpenAPI workflow without a matching update to
  `docs/adr/0001`/`0002`/`0003` or `docs/threat-model.md`.
- `coverage-gap-diagnosis` — reads local coverage output for files changed on this branch and
  names the specific untested branches/error paths, rather than a bare percentage.
- `venue-data-sync` — checks `mlbVenueFieldDimensions.ts`'s venue-id table against the live MLB
  Stats API and drafts entries for new/changed venues from a published source. Reactive, not
  scheduled — a franchise relocation or new ballpark is roughly once-a-decade.
- `bugbot-fix-verify` — verifies a Bugbot finding against actual code/docs/live behavior before
  fixing it, and re-verifies the fix resolves it without opening a new regression.
- `weekly-project-update` — summarizes the week's people-relevant caught-looking changes in
  plain language and opens (never merges) a PR in `danibsheehan.github.io` updating the "Caught
  Looking" portfolio section.

## Constraints — do not

- **Hand-edit `frontend/src/types/api.generated.ts`.** It's generated by `npm run api:types`
  from `backend/apidocs/openapi.yaml`; CI fails on drift. Extend `api.compat.ts` instead.
- **Call `statsapi.mlb.com` or Savant directly** from handlers (use `services.MLBClient` /
  Savant clients) or from the frontend (always go through the Go API).
- **Hit real upstream APIs in tests.** Use `httptest` fakes (backend) or mocked `api/client`
  (frontend) — see the test skills above.
- **Return raw upstream error bodies to clients.** Use `respondAPIError` /
  `respondUpstreamError` / `respondGetOrLoadError`.
- **Change a JSON response shape without updating `openapi.yaml`** in the same change (see
  `openapi-maintain` skill) — CI checks spec/handler/type drift.
- **Change cache TTLs, QPS limits, CORS/rate-limit/body-cap defaults, or security headers
  without updating the matching ADR (`docs/adr/`) or `docs/threat-model.md`** in the same
  change.
- **Bump React, Vite, TypeScript, Go, or CI Node/Go versions without updating the docs in the
  same change** — `make check-stack-docs` checks README/`project-stack.mdc`/`AGENTS.md` drift
  but does not fix it (the `doc-sync-patch` skill does).
- **Add or remove a `.cursor/skills/*/SKILL.md` directory without updating both
  `project-stack.mdc`'s Workflow skills bullet and this file's Step-by-step playbooks list in
  the same change** — `make check-skills-docs` checks this drift.
- **Commit secrets** (`.env`, credentials) or amend/force-push without being explicitly asked.
- **Open, push, or merge a PR unless the user asks.** (The one standing exception: the scheduled
  `weekly-project-update` routine may open — never merge — a PR in `danibsheehan.github.io`; see
  `docs/automation.md`.)

## Definition of done

- **Task done**: follow the scoped rule/skill for files touched; keep frontend edits
  Prettier-clean; run the smallest relevant check (focused package tests, `make check-openapi`
  if the API contract changed). Full CI is not required for every small edit.
- **PR done**: `make ci-local` green, then follow the `pr-ready` skill (PR template filled,
  summary leads with *why*, no secrets).
