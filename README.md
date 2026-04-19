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

Continuous integration (lint, typecheck, build, `go vet`, `go test`) runs in **GitHub Actions** on pushes to `main` and on pull requests.

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

## Repository layout

```
backend/    # Go HTTP API, MLB client, handlers, models
frontend/   # React SPA (src/, Vite)
Makefile    # install, dev, backend, frontend
```

## Contributing

Use the [pull request template](.github/pull_request_template.md). Keep API changes in sync: **Go JSON** ↔ **`frontend/src/types/api.d.ts`** and **`frontend/src/api/client.ts`**.
