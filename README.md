# caught-looking

Web app for exploring **MLB statistics** with charts and comparisons. The UI talks to a small **Go** backend that proxies and caches requests to the public **MLB Stats API** (`statsapi.mlb.com`).

## Features

- **Standings** — league standings for the configured season.
- **Teams** — team overview with season stats and record timelines.
- **Players** — side-by-side player comparison (radar, trends, game log) with hitting/pitching views.
- **Games** — date-based slate and **per-game** detail (timeline, boxscore-style views).

Routes in the SPA: `/standings`, `/teams`, `/players`, `/games`, `/games/:gamePk` (default landing: `/standings`).

## Tech stack

| Layer    | Technology |
| -------- | ---------- |
| Frontend | React 19, TypeScript, Vite, React Router, Recharts |
| Backend  | Go 1.22, [chi](https://github.com/go-chi/chi) router, TTL cache for upstream responses |
| Data     | MLB Stats API v1 (JSON over HTTPS) |

Continuous integration runs in **GitHub Actions** on **every branch push** and on **pull requests**: **frontend** — ESLint, TypeScript, **Vitest with V8 coverage**, production build; **backend** — `go vet`, **`go test` with coverage** (`go tool cover -func`), `go build`. On pull requests (same-repo workflows), a **sticky comment** is added or updated with the full frontend and backend coverage text (fork PRs may not receive the comment due to token limits; that step is non-blocking). Pushes to **`main`** can also run **Deploy** (Cloud Run API + Cloudflare Pages frontend) when repository variables and secrets are set; see **Deployment (CI)**.

## Prerequisites

- **Go** 1.22+
- **Node.js** 22+ and **npm** (CI uses Node 22; newer LTS generally works)

## Run locally

From the **repository root**:

```bash
make install   # once: Go modules + frontend npm dependencies
make dev       # API on :8080 + Vite dev server (with /api proxy)
```

- **API**: [http://127.0.0.1:8080](http://127.0.0.1:8080) — `GET /health` returns `ok`.
- **Frontend**: Vite (typically [http://localhost:5173](http://localhost:5173)) proxies `/api` to the backend so the browser uses same-origin `/api` in development.

Run services separately if you prefer:

```bash
make backend    # Go API only
make frontend   # Vite only (expects API on 127.0.0.1:8080 for `/api`)
```

### Frontend scripts (`frontend/`)

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Dev server |
| `npm run build` | Production bundle |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm run test` | Vitest (watch mode) |
| `npm run test:run` | Vitest once (matches CI) |
| `npm run test:coverage` | Vitest once with V8 coverage (`frontend/coverage/`, open `index.html`) |

Tests use **Vitest** (jsdom), **Testing Library**, and **`@testing-library/jest-dom`** matchers (`frontend/src/test/setup.ts`). Prefer mocking **`frontend/src/api/client`** in unit tests rather than calling the real API.

### Tests from the repo root (`Makefile`)

| Target | Purpose |
| ------ | ------- |
| `make test-backend` | `go test ./...` in `backend/` |
| `make test-frontend` | `npm run test:run` in `frontend/` |
| `make cover-backend` | Go coverage summary (`backend/coverage.out`) |
| `make cover-backend-html` | Same + `backend/coverage.html` |
| `make cover-frontend` | Vitest coverage report under `frontend/coverage/` |

Backend tests live as `*_test.go` next to packages under `backend/`. Frontend tests are colocated as `*.test.ts` / `*.test.tsx` next to sources. Conventions for agents and contributors are summarized in **`.cursor/skills/backend-go-tests/SKILL.md`** (Go) and **`.cursor/skills/frontend-vitest-tests/SKILL.md`** (frontend).

## Configuration

### Backend (environment variables)

| Variable | Purpose |
| -------- | ------- |
| `PORT` or `HTTP_ADDR` | Listen address (default `:8080`; `PORT` is prefixed with `:` if set) |
| `MLB_BASE_URL` | MLB Stats API base (default `https://statsapi.mlb.com/api/v1`) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (defaults include Vite on `5173`) |
| `MLB_SEASON` | Default season integer (e.g. `2026`) |
| `MLB_LEAGUE_IDS` | Default league ids for standings (default `103,104`) |
| `CACHE_TTL_STANDINGS` | Standings cache TTL (Go duration, e.g. `1h`) |
| `CACHE_TTL_SCORES` | Scores-related cache TTL (e.g. `5m`) |

### Frontend (Vite)

| Variable | Purpose |
| -------- | ------- |
| `VITE_API_BASE` | API base URL **without** trailing slash. In dev, omit it to use `/api` + the Vite proxy. For a direct backend URL (e.g. production or tools), set e.g. `http://localhost:8080`. |

## Deployment (CI)

Pushes to **`main`** run [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): build and push the API container to **Artifact Registry**, deploy to **Cloud Run**, then build the SPA with **`VITE_API_BASE`** set to the deployed service URL and publish **`frontend/dist`** to **Cloudflare Pages** (via [`cloudflare/pages-action`](https://github.com/cloudflare/pages-action)). Forks skip deploy jobs.

**One-time Google Cloud setup (example)**

- Enable billing, **Cloud Run**, **Artifact Registry**, and **Cloud Build** (optional; not required for this workflow’s Docker build in Actions).
- Create a **Docker** Artifact Registry repository (e.g. name matching `GCP_ARTIFACT_REPOSITORY`).
- Create a **service account** for GitHub with at least: **Artifact Registry Writer**, **Cloud Run Admin**, and **Service Account User** (on the project’s Cloud Run runtime service account if prompted). Create a JSON key and store it as **`GCP_SA_KEY`** (repository secret).

**One-time Cloudflare setup**

- Create a **Pages** project (name must match **`CLOUDFLARE_PAGES_PROJECT_NAME`**). The project can be empty; Actions uploads the build output.
- Create an **API token** with **Account → Cloudflare Pages → Edit** (and **Account → Read** if required by your account). Store **`CLOUDFLARE_API_TOKEN`** and **`CLOUDFLARE_ACCOUNT_ID`** as repository secrets.

**GitHub repository variables**

| Variable | Example | Purpose |
| -------- | ------- | ------- |
| `GCP_PROJECT_ID` | `my-gcp-project` | GCP project id |
| `GCP_REGION` | `us-central1` | Cloud Run and Artifact Registry region |
| `GCP_ARTIFACT_REPOSITORY` | `caught-looking` | Artifact Registry repo name (image: `…/api:<git-sha>`) |
| `CLOUDRUN_SERVICE_NAME` | `caught-looking-api` | Cloud Run service name |
| `CORS_ALLOWED_ORIGINS` | `https://your-project.pages.dev` | Comma-separated **`ALLOWED_ORIGINS`** for the API (must include your Cloudflare Pages origin). |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | `your-project` | If **unset**, only the API deploy runs (useful while wiring Cloudflare). |

**GitHub repository secrets**

| Secret | Purpose |
| ------ | ------- |
| `GCP_SA_KEY` | Service account JSON for GCP |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |

After the first successful deploy, **`CORS_ALLOWED_ORIGINS`** must include the real **`*.pages.dev`** (or custom domain) origin. If you add or change origins, update the variable and push to **`main`** (or update the Cloud Run service env) so CORS matches the browser.

## Repository layout

```
backend/    # Go HTTP API, MLB client, handlers, models
frontend/   # React SPA (src/, Vite, Vitest)
Makefile    # install, dev, backend, frontend, test-*, cover-*
```

## Contributing

Use the [pull request template](.github/pull_request_template.md). Before opening a PR, run the same checks as CI (e.g. `make test-backend`, `make test-frontend`, plus `npm run lint` / `npm run typecheck` / `npm run build` in `frontend/`, and `go vet ./...`, `go test ./...`, `go build` in `backend/`). Keep API changes in sync: **Go JSON** ↔ **`frontend/src/types/api.d.ts`** and **`frontend/src/api/client.ts`**.
