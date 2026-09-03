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

Conventions for this repo, organized by area. Read automatically by Claude Code via
[`CLAUDE.md`](CLAUDE.md); Cursor reads this file natively too.

### Backend (Go)

- **Router**: **chi** — register routes in **`router.go`** (`newRouter`). Group related routes under the rate-limited API group; keep path prefixes consistent with **`frontend/src/api/client.ts`** (`/api` may be stripped by the proxy — match how existing routes are mounted).
- **Handlers**: live in **`handlers/`**, depend on **`Handlers`** from `handlers.go` for `cfg`, `cache`, `mlb` (and Savant where used). Return JSON with appropriate status codes; use **`respondAPIError`**, **`respondUpstreamError`**, and **`respondGetOrLoadError`** — never return raw upstream `err.Error()` to clients.
- **Models**: request/response structs in **`models/`** — JSON field names must match **`backend/apidocs/openapi.yaml`** component schemas (they drive **`frontend/src/types/api.generated.ts`**). When the JSON contract changes, update the spec in the same PR; see **`.claude/skills/openapi-maintain/SKILL.md`**. For a full new route, see **`.claude/skills/add-api-endpoint/SKILL.md`**.
- **External data**: use **`services.MLBClient`** / Savant clients and **`TTLCache`** (`GetOrLoad`) rather than ad-hoc HTTP in handlers — see **`.claude/skills/caching-and-upstream-perf/SKILL.md`** (and ADRs **0001** / **0002** under **`docs/adr/`** when TTL or QPS policy changes).
- **Middleware**: CORS, logging, and HTTP rate limiting live under **`middleware/`**; gzip/compress is wired in **`router.go`**. Extend middleware packages for cross-cutting behavior. Security conventions: **`.claude/skills/backend-http-security/SKILL.md`**; threat model: **`docs/threat-model.md`**.
- **Tests**: follow **`.claude/skills/backend-go-tests/SKILL.md`** for httptest MLB fakes, chi routes, and shared `handlers` test helpers.

### Frontend (React)

- Use **function components** only. Derive UI from props and hooks; avoid class components.
- **Routing**: **`react-router`** — keep route-level views under `frontend/src/pages/`, reusable UI under `frontend/src/components/` (match existing folder layout).
- **Data fetching**: do not call `fetch` directly in components for app API data. Import **`fetch…` helpers from `../api/client`**, or wrap them in **`hooks/`**. Prefer **`useAsyncResource`** (AbortController cleanup, loading/error via `startTransition`) or mirror neighboring hooks — do not invent a one-off `useState`/`useEffect`/`setTimeout(0)` pattern when an existing hook fits.
- **Types**: import response/query types from **`frontend/src/types/api.compat`** (re-exports from OpenAPI-generated **`api.generated.ts`**). Don't inline large response shapes in components.
- **Styling**: follow patterns in `frontend/src/index.scss` and `frontend/src/styles/` (variables, utilities). Prefer existing classes and layout patterns over one-off inline styles unless there's a strong reason.
- **New class names / new components**: use **BEM** as defined in [BEM naming](#bem-naming) below. Leave legacy class strings unchanged unless the task is an explicit BEM migration.
- **Page filters / form controls**: reuse the shared field chrome in **`frontend/src/styles/features/_form-field.scss`** — `form-field`, `form-field__label`, `form-field__select`, `form-field__input` (and `--wide` / `--date` modifiers when needed). Mirror **Teams**, **Standings**, **Games**, and **Players** (Players may use the aliased `players-compare__*` classes that share the same styles). Do **not** invent classes like `form-field__control` or leave bare native `<select>` / `<input>` without those styles. Put filter rows in the page header (`*-page__header` / `games-slate__header` + controls) beside the title when other list pages do. For season year pickers, use a concrete default year in the URL/input (same idea as Teams/Players), not an empty "Default" placeholder. Prefer the same control type for the same concept across pages (e.g. hitting/pitching as a **Stat group** `<select>`, not a one-off tab strip).
- **Errors / a11y**: surface failures to the user (message or empty state), not silent `console.log` only. Prefer accessible names/roles for interactive controls.
- **Tests**: follow **`.claude/skills/frontend-vitest-tests/SKILL.md`** for Vitest, Testing Library, and mocked `api/client` (see also [Vitest / Testing Library tests](#vitest--testing-library-tests) below for `*.test.ts(x)` files).

### API client (`frontend/src/api`)

- **Base URL**: use `API_BASE` / `VITE_API_BASE` as already documented in `client.ts` — no hard-coded origins in new helpers.
- **Core helper**: use **`apiGet<T>(path)`** for JSON GETs. Paths are relative to `API_BASE`, start with `/` (e.g. `/standings`, `/teams/42/season-stats`).
- **New endpoints**: follow **`.claude/skills/add-api-endpoint/SKILL.md`** (OpenAPI → `api:types` → `api.compat` → `fetch…` → tests). OpenAPI regen details: **`.claude/skills/openapi-maintain/SKILL.md`**. Run **`make check-openapi`** before PR.
- **Naming**: `fetchStandings`, `fetchTeams`, `fetchGameTimeline` — verb + resource; align path segments with **`backend`** route registration (`router.go`).
- **Validation**: throw `Error` with a clear message for impossible client-side args (see `fetchRecordTimelinesBatch`). Let `apiGet` throw **`ApiError`** on non-OK HTTP (includes `status` and optional `requestId` from `X-Request-ID`).

```typescript
// Prefer
return apiGet<MyResponse>(`/resource/${id}${suffix}`)

// Avoid: raw fetch scattered outside this module for the same API
```

### Generated API types & compat layer

- **Contract source of truth**: **`backend/apidocs/openapi.yaml`**. Handler JSON must match the spec; CI runs Redocly lint and **`api:types:check`** on the generated file.
- **`api.generated.ts`**: produced by **`openapi-typescript`** — never edit by hand. Regenerate from `frontend/` with **`npm run api:types`** and commit when the spec changes.
- **`api.compat.ts`**: hand-maintained — re-exports `components['schemas']['…']`, derives query types from `operations['…']` via `QueryOf`, and holds any batch/query helpers the spec models awkwardly. Prefer extending this file over duplicating shapes in components or tests.
- **Naming**: keep stable app-facing names here (`Team`, `StandingsQuery`, etc.); underlying OpenAPI `operationId` / schema names stay in the YAML.

### BEM naming

The codebase still contains **some legacy** class names. **Do not rename** those in drive-by edits. **Migrations happen in dedicated changes.** Shared text tone uses the **`text`** block (`text text--muted`, `text text--small`, `text text--error`). Shared Recharts shells use the **`chart-frame`** block (optionally beside a chart-specific block, e.g. `team-wins-bar chart-frame`).

**When this rule applies (enforce)**:

- **New component files**: any new `*.tsx` under `frontend/src/components/` or `frontend/src/pages/` must use **BEM** for every `className` you introduce.
- **New styles**: any **new** selectors you add under `frontend/src/styles/` must be **BEM-shaped** (new blocks / elements / modifiers only). Extend legacy selectors only when matching existing markup.

**Naming shape**:

- **Block** (standalone): `block-name` — kebab-case, one conceptual UI unit (e.g. `game-day-row` → prefer a block like `games-slate` + elements instead of growing multi-purpose strings).
- **Element**: `block-name__element` — double underscore, belongs to that block only.
- **Modifier**: `block-name--modifier` or `block-name__element--modifier` — double hyphen, for variants and **state** (selected, disabled, active).

Prefer modifiers on the same node instead of unrelated "state classes", e.g. `foo__btn foo__btn--active` rather than `foo__btn is-active` **for new code**.

**SCSS**: put rules next to their block; use Sass nesting with `&__element` and `&--modifier` so renames stay local. Keep using existing **CSS variables** (`var(--accent)`, etc.) from `frontend/src/styles/_base.scss`; BEM is only the **class naming** layer.

**Practical notes**:

- **NavLink / conditional classes**: build strings from BEM parts (`block`, `block block--loading`, `block__link block__link--active`).
- **Tests**: when adding tests for new components, assert on roles/labels where possible; if you query by `className`, use the new BEM strings.

### Prettier formatting (frontend)

- **Config**: `frontend/prettier.config.js` (2-space indent, 100 print width, single quotes, semicolons, trailing commas).
- **Ignored**: see `frontend/.prettierignore` (e.g. `src/types/api.generated.ts` — format via `npm run api:types`, not Prettier).
- **CI gate**: `cd frontend && npm run format:check`.
- **Agent hook**: `.cursor/hooks/prettier-frontend.sh` runs on **`afterFileEdit`** for matching `frontend/` files (see `.cursor/hooks.json`) — this hook fires for Cursor sessions. Still run Prettier yourself if you bulk-edit outside the hook, the hook skips a path, or you're in a session the hook doesn't cover.

Before finishing a task, ensure every file you created or changed is Prettier-clean (hook usually does this in Cursor):

```bash
cd frontend && npx prettier --write path/to/changed-file.tsx path/to/other.scss
```

Use explicit paths (not `npm run format` on the whole tree) unless you touched many files. Do not rely on manual layout — match Prettier output exactly so `format:check` passes.

### Vitest / Testing Library tests

- **Runner / DOM**: Vitest + jsdom; config and coverage live in **`frontend/vite.config.ts`**.
- **Setup**: **`frontend/src/test/setup.ts`** — jest-dom matchers; **`cleanup()`** after each test so the DOM does not leak between cases.
- **Conventions**: follow **`.claude/skills/frontend-vitest-tests/SKILL.md`** for mocking `api/client`, `renderHook` + `waitFor`, user-event vs timers, and CI commands (`npm run test:run`, `npm run test:coverage`).
- **Scope**: unit / integration style tests only — no real network to production MLB; match patterns in existing `*.test.ts(x)` next to source files.

### OpenAPI contract

- **Source of truth for HTTP shapes**: `backend/apidocs/openapi.yaml` (served at `/openapi.yaml`, Redoc on GitHub Pages from `main` when the spec changes).
- **When you change** a handler's JSON (models, field names, status codes, paths, query params): update **`openapi.yaml`** in the **same change** so docs, lint, and typegen stay accurate. Full new route checklist: **`.claude/skills/add-api-endpoint/SKILL.md`**. Regen/compat steps: **`.claude/skills/openapi-maintain/SKILL.md`**.
- **Generated types**: `frontend/src/types/api.generated.ts` — do not hand-edit. From `frontend/`: `npm run api:types`. CI runs `npm run api:types:check` (must be clean `git diff` after regen).
- **Compat layer**: `frontend/src/types/api.compat.ts` — re-exports schema types and `QueryOf<operations['…']>` helpers; add exports here when the app needs a stable name or a query shape OpenAPI cannot express cleanly.
- **Lint**: from `frontend/`, `npm run api:validate` (Redocly, config in repo root `redocly.yaml`). From repo root: **`make check-openapi`** runs validate + types drift check.
- **Go ↔ YAML**: JSON struct tags on **`models/`** types should match property names in the spec; paths and operationIds should match how **`frontend/src/api/client.ts`** calls the API.
- **Why**: contract-first rationale is **`docs/adr/0003-openapi-contract.md`** — update that ADR only if the workflow (not a single endpoint) changes.

### README maintenance

When editing **README.md**, global tokens in **`frontend/src/styles/_base.scss`**, or stack sources of truth (**`frontend/package.json`**, **`backend/go.mod`**, **`.github/workflows/verify.yml`**), keep docs aligned with the repo:

**Tone (warm, audience-first)**:

- Lead with **who the reader is** and what they can do (try live, run locally, explore, contribute) before deep architecture.
- Prefer plain language in product sections; define jargon or link to **[`docs/`](docs/README.md)** (glossary + ADRs).
- **First use of jargon** (TTL, QPS, singleflight, CORS, CSP, XSS, RCE, SBOM, ADR, etc.) in any file this section covers gets a link to **[`docs/README.md#a-few-terms-in-plain-words`](docs/README.md#a-few-terms-in-plain-words)** — inline (`[TTL](docs/README.md#a-few-terms-in-plain-words)` from README.md; `[TTL](README.md#a-few-terms-in-plain-words)` from a file already inside `docs/`). A term used only once doesn't need its own paragraph of explanation if it's one click from a plain-language definition.
- **New acronym or term with no existing glossary row** → add one to the glossary table in `docs/README.md` in the same change, don't just gloss it inline once and let the glossary go stale.
- **Dense/technical sections** (cost tradeoffs, architecture, threat model actors/threats, SLO signals, etc.) open with a bolded **"In plain English:"** one-line summary before the technical table/prose — this is the existing pattern in `docs/configuration.md`, `docs/deploy.md`, `docs/threat-model.md`, and `docs/slo.md`; apply it to new dense sections anywhere this section covers, including README.md.
- **Diagrams** (mermaid or otherwise) get one plain-language sentence directly above them saying what they show, not just a heading.
- Avoid decorative or ambiguous table/column headers (glyphs, single symbols) — use a real word so the table reads sensibly out of context and for screen readers.
- Keep the dugout / neon-on-obsidian personality; avoid interview-only framing in the main product narrative (portfolio notes belong under Contributing or deeper docs).
- **Link out** for ops detail: env tables → **`docs/configuration.md`**; Cloud Run / Pages / GitHub vars → **`docs/deploy.md`**. Do not re-dump those tables into the README.

**Accuracy checklist**:

- **Features / product tour**: reflect actual SPA routes and major screens (`frontend/src/App.tsx`). Do not list planned work as shipped.
- **Design tokens**: the **Design tokens** section and its tables mirror `:root` / `html` custom properties in **`frontend/src/styles/_base.scss`** — update the README when those values or roles change.
- **Architecture / theme**: prose and mermaid around shell vs chart color paths must match the real pipeline (`mlbTeamObsidianRegistry`, `mlbTeamColors`, `chartColorContrast`, `neonChartPalette` under **`frontend/src/utils/`**). Do not describe chart series colors as if they were the same as the three-node shell stack unless that is literally true.
- **Design decisions / security docs**: README should **link** to **`docs/`**, **`docs/adr/`**, and **`docs/threat-model.md`** — do not duplicate ADR tables or the threat-model matrix in the README. If those paths move, update README Start here / Jump / Project layout / Contributing links in the same change. Rationale edits belong in the ADR or threat model (and the matching skill), not as a second copy here.
- **README assets**: markdown image links must point at committed files (badges and hero art are usually **`./docs/*.svg`** from the repo root). If an asset moves (for example under **`frontend/public/`**), update every README reference **and** the **Project layout** row that lists README art.
- **Run locally**: document **`make install`** / **`make dev`** from the repo root; note API `:8080`, Vite default port, and `/api` proxy behavior (`frontend/vite.config.ts`).
- **Tech stack / versions**: README badges, **Tech stack** table, and **Prerequisites** must match majors (and TypeScript major.minor) from **`frontend/package.json`**, the `go` directive in **`backend/go.mod`**, **`.nvmrc`** (Node major; Actions use `node-version-file`), and `go-version` in **`.github/workflows/verify.yml`**. Also keep the **Stack** line at the top of this file in sync (Go / React majors). Dependabot does not update these — when bumping React, Vite, TypeScript, Go, or CI Node/Go, update the docs in the same change (the **`doc-sync-patch`** skill automates this). Verify with **`make check-stack-docs`**.
- **Configuration**: env vars in **`docs/configuration.md`** must match **`backend/config/config.go`** and **`VITE_API_BASE`** usage in **`frontend/src/api/client.ts`**. Default TTL/QPS meaning lives in **ADRs**; keep env tables factual, not a second rationale essay. README keeps a short pointer only.
- **Deployment**: GitHub vars/secrets, one-time cloud setup, and rollback live in **`docs/deploy.md`**. Update that file (and the README pointer) when deploy workflows or required vars change.
- **CI**: if check commands, jobs, or coverage-comment behavior change, update the README (including the **CI & quality gates** summary and Makefile tables where relevant), **`.github/workflows/verify.yml`**, and the PR template in the same spirit.
- **AI automation**: **`docs/automation.md`**'s "runs on its own" vs. "on demand" split must match what's actually unattended — currently just `.github/workflows/dependabot-auto-merge.yml`'s scope and the weekly `dependabot-triage` routine. If either changes (new autonomous workflow, scope widens/narrows, a new scheduled routine), update `docs/automation.md` and the README **Dependabot** pointer in the same change. The underlying rule it describes — no AI-initiated merge/push/PR without a person asking — lives in this file; don't let that page imply broader autonomy than this rule actually allows.

Prefer short tables and copy-pasteable commands. Link to **`.github/pull_request_template.md`** for contribution expectations rather than duplicating long policy text.

## Step-by-step playbooks

Playbooks live in `.claude/skills/*/SKILL.md` (canonical) — `.cursor/skills` is a symlink to the
same directory, kept for Cursor compatibility. Both tools auto-invoke them by task. This repo
also installs the `foundations` plugin from the `dani-foundations` marketplace (see
`.claude/settings.json`), providing `dependabot-triage`, `coverage-gap-diagnosis`,
`pr-summary-draft`, `bugbot-fix-verify`, `caching-and-upstream-perf`, `doc-sync-patch`,
`api-hardening`, `react-vitest-testing`, and `go-http-testing` (namespaced `foundations:*`)
— no local copies of these needed for the generic parts; each was verified before
removing/trimming the local versions. `bugbot-fix-verify` was fully redundant (removed);
`caching-and-upstream-perf`, `doc-sync-patch`, `backend-http-security`,
`frontend-vitest-tests`, and `backend-go-tests` keep their local copies for this repo's
specific implementation (Go types, commands, exact patch locations, `api/client` mocking,
shared test helpers), cross-referencing the generic principles/mechanics instead of
restating them.

- `add-api-endpoint` — full route end-to-end: models → handler → router → OpenAPI → types →
  client → hook/UI → tests.
- `backend-go-tests` / `frontend-vitest-tests` — this repo's shared test helpers and
  mocking/fixture conventions; see `foundations:go-http-testing` /
  `foundations:react-vitest-testing` for the framework mechanics.
- `backend-http-security` — CORS, rate limits, body caps, error responses, threat model; see
  `foundations:api-hardening` for the general principles this implements.
- `caching-and-upstream-perf` — `TTLCache`, `GetOrLoad`, MLB/Savant QPS limits.
- `openapi-maintain` — keeping the spec, generated types, and compat layer in sync.
- `pr-ready` — local CI-parity checks and PR template before opening a PR.
- `doc-sync-patch` — patches README/`AGENTS.md` version drift after a dependency bump; run
  when `make check-stack-docs` fails or after bumping React, Vite, TypeScript, Go, or CI
  Node/Go.
- `adr-doc-sync-check` — flags when a diff changes cache TTL/QPS defaults, CORS/rate-limit/
  body-cap/security-header behavior, or the OpenAPI workflow without a matching update to
  `docs/adr/0001`/`0002`/`0003` or `docs/threat-model.md`.
- `venue-data-sync` — checks `mlbVenueFieldDimensions.ts`'s venue-id table against the live MLB
  Stats API and drafts entries for new/changed venues from a published source. Reactive, not
  scheduled — a franchise relocation or new ballpark is roughly once-a-decade.

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
- **Add or remove a `.claude/skills/*/SKILL.md` directory without updating this file's
  Step-by-step playbooks list in the same change** — `make check-skills-docs` checks this
  drift.
- **Commit secrets** (`.env`, credentials) or amend/force-push without being explicitly asked.
- **Merge a PR autonomously.** Merging is the step that ships — to production here, or to a live
  site for the portfolio routine — so it always needs a person, with exactly one standing
  exception: Dependabot auto-merge for the grouped npm minor/patch PR once required checks pass.
  See `docs/automation.md`.
- **Open or push a PR in an interactive session unless the user asks.** This is separate from the
  merge rule above: a scheduled, non-interactive workflow opening a PR on its own is fine when
  scoped to generated/mechanical content (see `docs/automation.md` for the two that do) — the
  restriction here is about an interactive agent session acting without being asked, not about
  PR creation being inherently risky.

## Definition of done

- **Task done**: follow the scoped convention/skill for files touched; keep frontend edits
  Prettier-clean (`.cursor/hooks/prettier-frontend.sh` on `afterFileEdit` in Cursor sessions,
  plus [Prettier formatting](#prettier-formatting-frontend) above); run the smallest relevant
  check (focused package tests, `make check-openapi` if the API contract changed). Full CI is
  not required for every small edit. For larger or risky changes, run `/code-review` manually
  before committing to catch issues early.
- **PR done**: `make ci-local` green, then follow the `pr-ready` skill (PR template filled,
  summary leads with *why*, no secrets). After merge, delete local (and, if not auto-deleted,
  remote) feature branches when cleaning up.
