# Caught looking

[![CI](https://github.com/danibsheehan/caught-looking/actions/workflows/ci.yml/badge.svg)](https://github.com/danibsheehan/caught-looking/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![OpenAPI docs](https://img.shields.io/badge/docs-Redoc-f472b6?style=flat-square&labelColor=070b10)](https://docs.caught-looking.com/)
[![Live app — caught-looking.com](./docs/badge-live.svg)](https://caught-looking.com/standings)
[![Go](https://img.shields.io/badge/Go-1.26-00ADD8?style=flat-square&logo=go&logoColor=white)](https://go.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=0a1018)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
![UI](https://img.shields.io/badge/UI-neon_on_obsidian-00f5c4?style=flat-square&labelColor=070b10)

[![Caught looking - neon on obsidian hero](./docs/readme-banner.svg)](https://caught-looking.com/standings)

> League tables, spray geometry, and Statcast-backed panels—**built for a dark dugout**, not a bright dashboard template.

**Caught Looking** is a web app for exploring **MLB statistics** with charts and comparisons. Browse standings, season leaders, team and player views, and game-day boards — including Statcast spray and pitch location when the data is there. Under the hood, a **Go** API proxies and caches the public **MLB Stats API** and, for some game views, **Baseball Savant**.

> [!TIP]
> **Try it live:** [caught-looking.com/standings](https://caught-looking.com/standings) · **API reference:** [docs.caught-looking.com](https://docs.caught-looking.com/)
>
> **Run it locally:** `make install` then `make dev` — API on **`:8080`**, site on **`:5173`**, browser calls **`/api`** through the Vite proxy.

## Start here

| I want to… | Go here |
| :--- | :--- |
| **Explore the live app** | [caught-looking.com/standings](https://caught-looking.com/standings) — no install |
| **Run it on my machine** | [Prerequisites](#prerequisites) → [Run locally](#run-locally) |
| **Understand the product** | [What you can explore](#what-you-can-explore) |
| **Contribute a change** | [Contributing](#contributing) |
| **Tune env vars or ship to the cloud** | [Configuration](docs/configuration.md) · [Deployment](docs/deploy.md) |
| **Read the “why” docs** | [docs/](docs/) — ADRs, SLOs, threat model, glossary |

New to terms like **TTL**, **QPS**, or **singleflight**? Plain-language
definitions: [glossary](docs/README.md#a-few-terms-in-plain-words).

**Jump:** [What you can explore](#what-you-can-explore) · [Architecture](#architecture) · [Design tokens](#design-tokens) · [Tech stack](#tech-stack) · [Project layout](#project-layout) · [Run locally](#run-locally) · [Contributing](#contributing) · [Docs home](docs/)

---

## What you can explore

A natural path through the app: **Standings → Leaders → Teams → Players → Games** (slate, then a single game’s timeline, box score, and Statcast).

| Area | What it’s for | Shareable URL |
| :--- | :--- | :--- |
| **Standings** | League tables for the configured season — where every club sits | — |
| **Leaders** | Season hitting and pitching leaders, with a top-10 bar above the table | Filters in the URL |
| **Teams** | Season stats and record timelines for a club | Team, season, panel tab |
| **Players** | Side-by-side compare (radar, trends, game log); hitting or pitching | `ids`, season, scope, group |
| **Games** | Day slate plus per-game timeline, box score, and Statcast (spray / pitch dots or zone density); live games refresh while you’re watching | Slate `date` / optional `team` |
| **API docs** | Human-readable OpenAPI (Redoc) from the same contract the app uses | [docs.caught-looking.com](https://docs.caught-looking.com/) |

Routes: `/standings` (default), `/leaders`, `/teams`, `/players`, `/games`, `/games/:gamePk` — see [`App.tsx`](frontend/src/App.tsx).

### Live games

On a **game detail** page, the box score and inning timeline refresh while the game is still unsettled (about every **45 seconds**, matching the live cache [TTL](docs/README.md#a-few-terms-in-plain-words)). Statcast loads once. Polling **pauses** when the browser tab is hidden, refreshes immediately when you come back, and **stops** when the game is final, postponed, or cancelled — so the board stays fresh without hammering league APIs when nobody is watching.

**Try it:** open a live (or unsettled) game → watch Network for boxscore/timeline on a ~45s cadence → switch tabs (polls stop) → return (one immediate refresh). Hook: `useAsyncResource` `poll` + `pauseWhenHidden`. See [ADR 0001](docs/adr/0001-cache-ttls.md).

| Aspect | Theme |
| :---: | :--- |
| **Surfaces** | Near-black fields (`#070b10`, `#0a1018`) with cool gray body type |
| **Accent** | Teal `--accent` (`#00f5c4`) for links, focus, and primary chart chrome |
| **Type** | **DM Sans** for prose; **Space Mono** for numerals and axes |
| **Charts** | Team ink via registry + brand palette; [`neonChartPalette.ts`](frontend/src/utils/neonChartPalette.ts) is a non-team series helper (not extra `html` CSS variables) |

| Aspect | What stands out (for builders) |
| :---: | :--- |
| **Contract** | Handlers and the SPA share one **OpenAPI** spec → generated TypeScript types + Redoc |
| **Color** | **Shell** tokens in SCSS; **team ink** from registry + MLB brand picks, contrast-adjusted per chart surface |
| **Ops** | Per-IP limits, outbound **[QPS](docs/README.md#a-few-terms-in-plain-words) caps**, and TTL caches so public upstreams stay friendly at scale |

---

## Architecture

**In plain English:** the browser only ever talks to our own Go API, never
directly to MLB or Savant. The API remembers recent answers for a while
(caching) and paces how often it asks the league for fresh ones — that's
the whole story behind most of the jargon below. Unfamiliar term? Check the
[glossary](docs/README.md#a-few-terms-in-plain-words).

| Layer | Role |
| :--- | :--- |
| **Browser** | React SPA → same-origin **`/api`** (Vite proxy in dev; `VITE_API_BASE` in prod) |
| **Go API** | Cache TTLs, per-IP limits, outbound QPS caps |
| **Upstream** | **MLB** Stats API (JSON) for most routes; **Savant** (CSV) for Statcast game views only |

Hosted as Cloudflare Pages (site) + Cloud Run (API). See [Deployment](docs/deploy.md).

### Design decisions

Rationale for cache TTLs, outbound QPS, and the OpenAPI contract: **[docs/adr/](docs/adr/)** (ADRs 0001–0003). Skills under `.cursor/skills/` are the how-to; ADRs record the tradeoffs. Start with the friendly [docs home](docs/).

### Cost and scale tradeoffs

**In plain English:** every choice below trades a little bit of "not
infinitely scalable" for keeping the cloud bill near $0. That's a deliberate
tradeoff for a hobby-scale public app, not an oversight.

Built for a **low/zero incremental cloud bill** (Cloud Run scale-to-zero + Cloudflare Pages) without treating public MLB/Savant as free bandwidth. Conscious limits — not missing infrastructure:

| Choice | Why it stays this way | Revisit when |
| :--- | :--- | :--- |
| **In-process TTL cache + [singleflight](docs/README.md#a-few-terms-in-plain-words)** | No Redis/Memorystore cost; concurrent misses coalesce **per process**; hit/miss/coalesce + latency histograms show up on `GET /metrics` ([SLOs](docs/slo.md)). Prove locally with **`make load-smoke`**. | Warm instance count or cold-start stampede forces a shared L2 |
| **Per-process MLB/Savant QPS caps** | Predictable outbound load without a global rate coordinator | Aggregate `max-instances × QPS` risks upstream 429s |
| **`CLOUDRUN_MAX_INSTANCES` default `2`** | Caps spend **and** the outbound budget multiplier | Traffic needs more capacity *and* a shared cache/limiter story |
| **`CLOUDRUN_MIN_INSTANCES` default `0`** | Idle ≈ $0; cold starts refill the in-memory cache | Latency SLOs require a warm process ([docs/slo.md](docs/slo.md)) |

Residual risks (per-process QPS × instances, in-memory-only stampede) are spelled out in **[docs/threat-model.md](docs/threat-model.md)**. Informal latency/hit-ratio targets: **[docs/slo.md](docs/slo.md)**. Deploy knobs: [Deployment](docs/deploy.md).

The same picture as the table above, drawn out: the browser only ever calls our API, and only the API talks to MLB or Savant.

```mermaid
%%{init: {'theme':'dark'}}%%
flowchart LR
  subgraph ui["Browser"]
    SPA["React SPA<br/>Recharts · neon chrome"]
  end
  subgraph api["Go API · chi"]
    SRV["Handlers + cache<br/>rate limit · QPS caps"]
  end
  subgraph up["Upstream"]
    MLB["MLB Stats API<br/>JSON"]
    SAV["Baseball Savant<br/>CSV / Statcast"]
  end
  SPA -->|"GET /api/*"| SRV
  SRV -->|"most routes"| MLB
  SRV -->|"Statcast only"| SAV
```

### Performance snapshot

**In plain English:** cache hits answer in single-digit milliseconds; concurrent cache misses share one upstream call instead of each triggering its own, so latency stays flat as concurrent traffic grows rather than degrading.

<!-- perf-metrics:start -->
Warm cache-hit p95: **4.8ms** · Cold cache-miss p95: **487.5ms** · Measured 2026-08-24 at up to 500 concurrent clients — [full sweep and methodology](docs/perf-results.md).
<!-- perf-metrics:end -->

### Upstream by feature

| SPA area | Primary upstream | Notes |
| :--- | :--- | :--- |
| Standings, Leaders, Teams, Players, Games slate / boxscore / timeline | **MLB** Stats API (JSON) | Typical path below |
| Game Statcast (spray / launch metrics) | **Savant** CSV | Optional parallel **MLB** `/schedule` for venue only — MLB failure does not fail the request |
| Game Statcast pitches (location / type) | **Savant** CSV only | Shared Savant download cache with batted-ball Statcast (`savant-csv:{gamePk}`) |

### Request path — typical MLB-backed read

Most of the app: JSON in, JSON out. Go adds cache keys, rate limits, and upstream timeouts.

```mermaid
%%{init: {'theme':'dark'}}%%
sequenceDiagram
    autonumber
    participant SPA as React SPA
    participant API as Go API chi
    participant MLB as MLB Stats API
    SPA->>+API: GET /api/…
    API->>MLB: proxied GET (TTL cache)
    MLB-->>API: JSON
    API-->>-SPA: 200 + JSON
```

### Request path — Statcast (Savant-backed)

Game Statcast panels do **not** follow the MLB-primary path. Savant CSV is the source of truth; both Statcast endpoints share one cached CSV fetch per `gamePk`.

```mermaid
%%{init: {'theme':'dark'}}%%
sequenceDiagram
    autonumber
    participant SPA as React SPA
    participant API as Go API chi
    participant SV as Savant CSV
    participant MLB as MLB Stats API
    SPA->>+API: GET /api/games/{gamePk}/statcast…
    par Required
        API->>SV: Statcast Search CSV (TTL cache)
        SV-->>API: CSV rows
    and Optional (batted-ball endpoint only)
        API->>MLB: GET /schedule?gamePks=… (venue)
        MLB-->>API: JSON or skip on error
    end
    API-->>-SPA: 200 + JSON (parsed Statcast)
    Note over API,MLB: Pitches endpoint skips MLB entirely
```

### App chrome (CSS)

Global shell only (bottom → top). This stack does **not** include chart series colors.

_Arrows = stacking narrative for the shell, not layout or data flow._

```mermaid
%%{init: {'theme':'dark'}}%%
flowchart BT
  void["#070b10<br/>void"] --> surface["#0a1018<br/>surface"] --> teal["#00f5c4<br/>--accent"]
  style void fill:#070b10,stroke:#0f1e2d,color:#8b9cad
  style surface fill:#0a1018,stroke:#0f1e2d,color:#c8d8e8
  style teal fill:#0a1018,stroke:#00f5c4,color:#00f5c4
```

### Chart data ink (dynamic)

Team-branded series are keyed by **team id** from the API — not the three-node shell stack above.

| Step | Module | Role |
| :--- | :--- | :--- |
| Obsidian pairs | [`mlbTeamObsidianRegistry.ts`](frontend/src/utils/mlbTeamObsidianRegistry.ts) | Ink / label pairs tuned for dark charts |
| Brand resolve | [`mlbTeamColors.ts`](frontend/src/utils/mlbTeamColors.ts) | MLB primaries/secondaries, comparison fallbacks, distinctness |
| Contrast | [`chartColorContrast.ts`](frontend/src/utils/chartColorContrast.ts) | Nudge colors vs the plot surface |
| Non-team palette | [`neonChartPalette.ts`](frontend/src/utils/neonChartPalette.ts) | Teal / violet / pink-tinted series helper (unit-tested; app charts today use the team path above) |

```mermaid
%%{init: {'theme':'dark'}}%%
flowchart LR
  ID["Team id(s)<br/>from API"] --> pick["Registry + / or<br/>brand palette"]
  pick --> adj["Contrast vs<br/>chart surface"]
  adj --> R["Recharts<br/>fills · strokes"]
```

---

## Design tokens

Defined on `html` in [`frontend/src/styles/_base.scss`](frontend/src/styles/_base.scss). Update these tables when values change.

**Typography** — font stacks on `html` (full fallbacks in the SCSS file):

| Variable | Face | Use |
| :--- | :--- | :--- |
| `--sans` / `--heading` | DM Sans | UI and headings |
| `--mono` | Space Mono | Numerals and axis ticks |

### Colors & surfaces

| CSS variable | Hex / value | Role                        |
| :----------- | :---------- | :-------------------------- |
| `--bg`       | `#070b10`   | Deepest background          |
| `--surface`  | `#0a1018`   | Panels and cards            |
| `--text`     | `#8b9cad`   | Body (AA vs `--bg`)         |
| `--text-h`   | `#c8d8e8`   | Headings, `code` foreground |
| `--muted`    | `#5a6b7c`   | Secondary labels            |
| `--border`   | `#0f1e2d`   | Shell edges, dividers       |
| `--code-bg`  | `#0d121a`   | Inline `code` background    |

### Charts

| CSS variable         | Hex / value | Role                               |
| :------------------- | :---------- | :--------------------------------- |
| `--chart-tick`       | `#4a5f72`   | Default axis tick color            |
| `--chart-grid-faint` | `#0d1a26`   | Faint grid lines                   |
| `--chart-y-mid`      | `#0f2030`   | Reference band (e.g. 50% win line) |
| `--chart-y-mid-tick` | `#1a3a30`   | Tick on that reference             |

### Accent & depth

| CSS variable      | Hex / value            | Role                                                     |
| :---------------- | :--------------------- | :------------------------------------------------------- |
| `--accent`        | `#00f5c4`              | Teal neon — links, active chrome, primary chart emphasis |
| `--accent-bg`     | `rgba(0,245,196,0.08)` | Soft teal wash on surfaces                               |
| `--accent-border` | `rgba(0,245,196,0.45)` | Focus / selected borders                                 |
| `--shadow`        | layered `rgba` blacks  | Panel depth (see file)                                   |

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript 6.0, Vite, React Router, Recharts, ESLint, Prettier |
| Backend | Go 1.26, [chi](https://github.com/go-chi/chi), TTL cache, per-IP rate limit, inbound body size cap, token-bucket QPS caps (MLB + Savant) |
| Data | MLB Stats API v1 (JSON); Baseball Savant (CSV) for Statcast game data |

<details>
<summary><strong>CI & quality gates</strong> (expand)</summary>

Skip this if you're just trying the app or reading code — it's reference detail
for anyone opening a PR who wants to know exactly what has to pass.

Runs in **GitHub Actions** on pushes to **`main`** and on **non-draft** pull requests. Draft PRs skip CI until **Ready for review**. Local parity: **`make ci-local`**.

#### Required gates

| Job | Checks |
| --- | --- |
| **Frontend** | `make check-stack-docs`, OpenAPI lint (`api:validate`), type drift (`api:types:check`), ESLint, Prettier (`format:check`), TypeScript, `npm audit` (high+), Vitest + V8 coverage, production build |
| **Backend** | `go vet`, `govulncheck`, `go test -race`, `go test` + coverage (Cobertura via `gocover-cobertura`), `go build` |
| **lint-backend** | `golangci-lint` (errcheck, staticcheck, govet, and more) on `backend/**` — see `make lint-backend` |

#### Optional (not required for merge)

| Job | What it does |
| --- | --- |
| **e2e** | Playwright: stub smoke + deep-link/density matrix (`vite preview` + stubbed `/api`), contract path (real Go API + fixture MLB/Savant), and chaos path (fixture `PUT /_chaos` → 429/5xx/slow) |
| **sbom** | Syft SPDX [SBOM](docs/README.md#a-few-terms-in-plain-words) of the repo — uploaded as a workflow artifact |

#### When jobs run

| Trigger | Behavior |
| --- | --- |
| **Draft PR** | CI skipped until Ready for review |
| **PR (ready)** | Path filters skip heavy frontend/backend/lint-backend steps when that side’s paths are unchanged (jobs still report green for required checks — this is why **lint-backend** keeps its own in-job filter rather than being skipped entirely like the optional jobs below). Optional **e2e** / **sbom** are skipped entirely when their paths are unchanged (via **Detect optional CI paths**; not a green no-op) |
| **Push to `main`** | Required frontend/backend/lint-backend gates always run fully. Optional **e2e** / **sbom** skip entirely when paths are unchanged. **Deploy** may also run when vars/secrets are set — see [Deployment](docs/deploy.md) |
| **Cloudflare PR preview** | Workflow starts only when `frontend/**`, `.nvmrc`, or the preview workflow change; job still skips drafts, Dependabot, and forks |

#### Same-repo PR helpers

| Workflow / job | Role |
| --- | --- |
| [**PR guide**](.github/workflows/pr-guide.yml) | On open / reopen / ready-for-review: scaffolds empty/default PR description (verify commands, **Touches**), sticky checklist comment, `area:*` labels from changed paths (does not re-run on every push). Authors/agents should still write a why-first **Summary**. |
| **Coverage comments** (CI job) | After frontend/backend succeed, posts or updates Cobertura coverage comments from uploaded artifacts (same-repo PRs only; does not run on `main`) |
| [**Pages preview**](.github/workflows/pages-preview.yml) | Builds SPA with `VITE_API_BASE` → Cloudflare branch preview; does not run at all for non-SPA path PRs |
| **Lighthouse** (job in [pages preview](.github/workflows/pages-preview.yml)) | After the preview deploys, audits that live URL with Lighthouse CI and comments the report link; warn-level thresholds in [`.lighthouserc.json`](.lighthouserc.json), non-blocking |
| [**Preview cleanup**](.github/workflows/pages-preview-cleanup.yml) | Deletes preview deployments when the PR is closed or merged |

Fork PRs may skip guide, coverage comments, or previews (`GITHUB_TOKEN` / secrets limits); those steps are non-blocking or skipped.

#### Dependabot

[`.github/dependabot.yml`](.github/dependabot.yml) opens **weekly** version PRs for:

- **Go modules** (`backend/`)
- **npm** (`frontend/` — minor/patch **grouped**)
- **GitHub Actions** (ungrouped)

The grouped npm minor/patch PR auto-merges on its own once required CI passes ([`dependabot-auto-merge.yml`](.github/workflows/dependabot-auto-merge.yml)). Everything else — Go modules, GitHub Actions, and any ungrouped npm major bump — still needs a human merge; a weekly scheduled Claude Code routine reads each one's changelog and required CI to classify risk and post a report, but only merges PRs a person names explicitly (see [`dependabot-triage`](.cursor/skills/dependabot-triage/SKILL.md) for the logic it follows, and [AI-assisted development & automation](docs/automation.md) for the full picture of what runs unattended here vs. on request).

It does **not** update README badges or Prerequisites. When a bump changes React / Vite / TypeScript / Go / CI Node majors (or TypeScript major.minor), update those docs in the same PR — CI’s `make check-stack-docs` catches drift. Review Dependabot PRs like any other change (`govulncheck` and `npm audit` still gate merges).

Also enable **Dependabot alerts** and **Dependabot security updates** under GitHub **Settings → Code security** for advisory fix PRs outside the weekly cadence.

</details>

---

## Project layout

| Concern | Path |
| :--- | :--- |
| Shell / routes | [`frontend/src/App.tsx`](frontend/src/App.tsx), [`_shell.scss`](frontend/src/styles/_shell.scss) |
| Global theme | [`_base.scss`](frontend/src/styles/_base.scss); feature SCSS under `frontend/src/styles/features/` |
| Pages (routes) | `frontend/src/pages/` |
| Pages (Cloudflare) | [`frontend/public/_redirects`](frontend/public/_redirects) (SPA fallback), [`frontend/public/_headers`](frontend/public/_headers) (CSP / nosniff / frame / referrer) |
| SEO | [`frontend/public/robots.txt`](frontend/public/robots.txt), [`frontend/public/sitemap.xml`](frontend/public/sitemap.xml) (static top-level routes only); description / Open Graph / Twitter card meta in [`frontend/index.html`](frontend/index.html) |
| API client | [`frontend/src/api/client.ts`](frontend/src/api/client.ts) — `VITE_API_BASE` or `/api` in dev |
| Types | `frontend/src/types/api.generated.ts`, `frontend/src/types/api.compat.ts` |
| Backend | `backend/` — chi, MLB + Savant clients, `backend/apidocs/openapi.yaml` |
| Docs home | [`docs/`](docs/) — map, glossary, ADRs, SLOs, threat model, [configuration](docs/configuration.md), [deploy](docs/deploy.md) |
| README art | [`docs/readme-banner.svg`](docs/readme-banner.svg), [`docs/badge-live.svg`](docs/badge-live.svg) |
| Load / coalesce proof + latency sweep | [`scripts/load-smoke.sh`](scripts/load-smoke.sh) — `make load-smoke` (fixture upstream, no live MLB) |

```
backend/    # Go HTTP API, MLB + Savant clients, handlers, models
frontend/   # React SPA (src/, Vite, Vitest, Playwright e2e/)
docs/       # ADRs, SLOs, threat model, configuration, deploy
.vscode/    # Editor: format on save (Prettier), recommended extensions
Makefile    # install, dev, backend, frontend, ci-local, test-*, cover-*
```

---

## Prerequisites

- **Go** 1.26+ — builds the API
- **Node.js** 22+ and **npm** — builds the site (CI uses Node 22; pin with [`.nvmrc`](.nvmrc) / `nvm use`)

You do not need cloud accounts to explore locally.

---

## Editor setup

**VS Code** / **Cursor**: format-on-save for `frontend/` via Prettier. Install the recommended [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) when prompted; accept workspace settings if asked.

| What | Where |
| :--- | :--- |
| Format on save | [`.vscode/settings.json`](.vscode/settings.json) — Prettier for TS/TSX/JS/JSON/SCSS/HTML under `frontend/` |
| Prettier config | `frontend/prettier.config.js` |
| EditorConfig | [`.editorconfig`](.editorconfig) — indent, charset, newlines (Go 4-space; Makefile tabs) |
| Node pin | [`.nvmrc`](.nvmrc) — Actions and local `nvm use` |
| Cursor agents | [`.cursor/rules/frontend-prettier.mdc`](.cursor/rules/frontend-prettier.mdc) — `npx prettier --write` on changed files |

CI still runs `npm run format:check`.

---

## Run locally

From the **repository root**:

```bash
make install   # once: Go modules + frontend npm dependencies
make dev       # API on :8080 + Vite dev server (with /api proxy)
```

- **API**: [http://127.0.0.1:8080](http://127.0.0.1:8080) — `GET /health` (liveness → `ok`), `GET /ready` (process invariants → `ready`, never probes MLB); responses include `X-Request-ID` (SPA surfaces it on API errors); `GET /metrics` exposes Prometheus text (see [docs/slo.md](docs/slo.md)); `GET /docs` / `GET /openapi.yaml` serve the contract. Ops paths are documented in OpenAPI (tag **Ops**). Prove singleflight under concurrency with **`make load-smoke`**.
- **Frontend**: Vite (typically [http://localhost:5173](http://localhost:5173)) proxies `/api` to the backend so the browser uses same-origin `/api` in development.

Run services separately if you prefer:

```bash
make backend    # Go API only
make frontend   # Vite only (expects API on 127.0.0.1:8080 for `/api`)
```

### Frontend scripts (`frontend/`)

| Command                   | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`             | Dev server                                                             |
| `npm run build`           | Production bundle                                                      |
| `npm run preview`         | Preview production build                                               |
| `npm run lint`            | ESLint                                                                 |
| `npm audit --audit-level=high` | Fail on high/critical advisories (CI)                            |
| `npm run format`          | Prettier — write (`src/types/api.generated.ts` is ignored; run `api:types` separately) |
| `npm run format:check`    | Prettier — check only (CI)                                            |
| `npm run typecheck`       | TypeScript `--noEmit`                                                  |
| `npm run api:validate`    | Lint OpenAPI (`backend/apidocs/openapi.yaml`)                          |
| `npm run api:types`       | Generate `src/types/api.generated.ts` from OpenAPI                     |
| `npm run api:types:check` | Regenerate + fail if `api.generated.ts` is stale                       |
| `npm run test`            | Vitest (watch mode)                                                    |
| `npm run test:run`        | Vitest once (matches CI)                                               |
| `npm run test:coverage`   | Vitest once with V8 coverage (`frontend/coverage/`, open `index.html`) |
| `npm run test:e2e`        | Playwright Chromium stub smoke + matrix (`vite build` + preview; stubbed `/api`) |
| `npm run test:e2e:contract` | Playwright contract path (Go API + `e2e-upstream` fixtures; no live MLB) |
| `npm run test:e2e:chaos` | Playwright degradation path (fixture upstream `PUT /_chaos` → 429/5xx/slow) |

| Concern | Detail |
| :--- | :--- |
| Unit tests | Vitest (jsdom) + Testing Library + `@testing-library/jest-dom` ([`frontend/src/test/setup.ts`](frontend/src/test/setup.ts)) |
| Mocking | Prefer mocking [`frontend/src/api/client`](frontend/src/api/client.ts) over the real API |
| Browser smoke | `frontend/e2e/` (Playwright) — stub smoke + deep-link/density matrix: `npm run test:e2e` / `make test-e2e`; contract: `npm run test:e2e:contract` / `make test-e2e-contract`; chaos (fixture 429/5xx/slow): `npm run test:e2e:chaos` / `make test-e2e-chaos`; install once: `npx playwright install chromium` |

### OpenAPI workflow

| Step | Command / path |
| :--- | :--- |
| Spec source | `backend/apidocs/openapi.yaml` |
| Live Redoc | [docs.caught-looking.com](https://docs.caught-looking.com/) |
| Validate | `cd frontend && npm run api:validate` |
| Generate types | `cd frontend && npm run api:types` |
| App-facing types | `frontend/src/types/api.compat.ts` (from `api.generated.ts`) |
| Docs deploy | `.github/workflows/openapi-pages.yml` — Redoc from `main` when the OpenAPI file changes |

### Tests from the repo root (`Makefile`)

| Target                    | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `make ci-local`           | Full local parity with GitHub Actions CI (stack docs + frontend + backend jobs) |
| `make ci-local-frontend`  | Frontend CI job only (audit, OpenAPI, lint, format, typecheck, coverage ≥50%, build) |
| `make ci-local-backend`   | Backend CI job only (vet, govulncheck, race, coverage ≥50%, build)      |
| `make check-stack-docs`   | README / project-stack versions match `package.json`, `go.mod`, and CI  |
| `make check-openapi`      | Lint OpenAPI + verify generated frontend API types are current          |
| `make test-backend`       | Faster backend subset: `go vet`, `govulncheck`, tests, build            |
| `make test-backend-race`  | Backend tests with the race detector                                    |
| `make test-frontend`      | `npm run test:run` in `frontend/`                                       |
| `make test-e2e`           | Playwright Chromium stub smoke (`frontend/e2e/`; stubbed `/api`)        |
| `make test-e2e-contract`  | Playwright against Go API + fixture upstream (`cmd/e2e-upstream`)       |
| `make test-e2e-chaos`     | Playwright upstream chaos (429/5xx/slow via `PUT /_chaos`)              |
| `make load-smoke`         | Concurrent `/standings` burst across a 10/40/100/500 sweep; asserts coalesce + warm hits and reports cold/warm p50/p95 latency via `/metrics` |
| `make cover-backend`      | Go coverage summary (`backend/coverage.out`)                            |
| `make cover-backend-html` | Same + `backend/coverage.html`                                          |
| `make cover-frontend`     | Vitest coverage report under `frontend/coverage/`                       |

| Where tests live | Convention |
| :--- | :--- |
| Backend | `*_test.go` next to packages under `backend/` — [`.cursor/skills/backend-go-tests/SKILL.md`](.cursor/skills/backend-go-tests/SKILL.md) |
| Frontend | `*.test.ts` / `*.test.tsx` next to sources — [`.cursor/skills/frontend-vitest-tests/SKILL.md`](.cursor/skills/frontend-vitest-tests/SKILL.md) |

---

## Configuration

Env vars for the API and SPA (listen address, cache TTLs, rate limits, `VITE_API_BASE`, and more) live in **[docs/configuration.md](docs/configuration.md)**. Defaults work for local `make dev`; change them when deploying or practicing limits. Cache/QPS *rationale* stays in the [ADRs](docs/adr/).

---

## Deployment

Production ship path (Cloud Run + Cloudflare Pages), GitHub variables/secrets, one-time cloud setup, and rollback notes: **[docs/deploy.md](docs/deploy.md)**.

---

## Contributing

Glad you’re here. Small, well-described changes are welcome.

| Step | Action |
| :--- | :--- |
| Template | [PR template](.github/pull_request_template.md) — **Summary** (why + what) + **How to verify** |
| Scaffold | [PR guide](.github/workflows/pr-guide.yml) fills empty/default descriptions (verify commands, **Touches**) and posts a sticky checklist; still lead Summary with why |
| Before open | `make ci-local` from repo root (same gates as CI: stack-docs, `npm audit`, coverage ≥50%, OpenAPI type drift) |
| API changes | Keep **Go JSON / OpenAPI** ↔ `frontend/src/types/api.generated.ts` + `frontend/src/api/client.ts` in sync |
| Agents | [`.cursor/skills/pr-ready/SKILL.md`](.cursor/skills/pr-ready/SKILL.md) |

**Security:** unauthenticated read proxy + SPA Pages headers — [threat model](docs/threat-model.md). Handler conventions: [`.cursor/skills/backend-http-security/SKILL.md`](.cursor/skills/backend-http-security/SKILL.md).

Deeper reading: **[docs/](docs/)**.

---

## License

[MIT](LICENSE) — use it, fork it, learn from it.
