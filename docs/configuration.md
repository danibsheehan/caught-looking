# Configuration

Environment knobs for the Go API and the Vite SPA. Defaults match `backend/config/config.go` and local `make dev`. **Why** the cache and QPS defaults look the way they do lives in the [ADRs](adr/), not here. Unfamiliar with terms like TTL, QPS, or CORS? See the [glossary](README.md#a-few-terms-in-plain-words).

**In plain English:** Most people never need to change these. Local `make dev` works with the defaults. Tune them when you deploy, point at a different upstream, or practice load/abuse limits.

Back to the [docs home](README.md) · [root README](../README.md).

## Backend (environment variables)

### Listen & upstreams

| Variable | Purpose |
| --- | --- |
| `PORT` or `HTTP_ADDR` | Listen address (default `:8080`; `PORT` is prefixed with `:` if set) |
| `MLB_BASE_URL` | MLB Stats API base (default `https://statsapi.mlb.com/api/v1`) |
| `SAVANT_BASE_URL` | Baseball Savant base (default `https://baseballsavant.mlb.com`; trailing slashes stripped) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (defaults include Vite on `5173`) |
| `MLB_SEASON` | Default season (current calendar year; override e.g. `2025`) |
| `MLB_LEAGUE_IDS` | Default league ids for standings (default `103,104`) |

### Cache

| Variable | Purpose |
| --- | --- |
| `CACHE_TTL_STANDINGS` | Standings TTL (Go duration; default `1h`) |
| `CACHE_TTL_SCORES` | Scores-related TTL (default `5m`) |
| `CACHE_TTL_LIVE_SCORES` | Today/live scoreboards + in-game boxscore/timeline (default `45s`) |
| `CACHE_TTL_STATCAST` | Statcast / Savant CSV per game (default `6h`) |
| `CACHE_TTL_PLAYER_SEARCH` | Player-search name query keys (default `3m`) |
| `CACHE_SWEEP_INTERVAL` | Expired-entry sweep + `CACHE_MAX_ENTRIES` enforcement (default `2m`; `0` disables) |
| `CACHE_MAX_ENTRIES` | Max entries before sweeps trim to ~90% (default `2000`; `0` = unlimited) |

See [ADR 0001](adr/0001-cache-ttls.md) for adaptive TTL policy.

### Limits & outbound QPS

| Variable | Purpose |
| --- | --- |
| `RATE_LIMIT_REQUESTS` | Max requests per client IP per window (default `120`; `0` disables) |
| `RATE_LIMIT_WINDOW` | Sliding window for that limit (default `1m`) |
| `HTTP_MAX_BODY_BYTES` | Max inbound body bytes (default `65536`; `0` disables). Oversize → 413 |
| `MLB_MAX_QPS` | Outbound MLB GETs/sec **per process** (token bucket, default `20`; `0` = unlimited) |
| `MLB_HTTP_TIMEOUT` | Per-attempt MLB timeout (default `15s`; `0s`/negative → client default `15s`) |
| `SAVANT_MAX_QPS` | Outbound Savant GETs/sec **per process** (default `5`; `0` = unlimited) |
| `SAVANT_HTTP_TIMEOUT` | Per-attempt Savant timeout (default `30s`; `0s`/negative → client default `30s`) |

See [ADR 0002](adr/0002-upstream-qps.md) for outbound courtesy tradeoffs.

## Frontend (Vite)

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE` | API origin **without** trailing slash. Omit in dev (`/api` + Vite proxy). Production builds for [caught-looking.com](https://caught-looking.com/standings) / [www](https://www.caught-looking.com/standings) set this to the Cloud Run API URL. |

Without **`VITE_API_BASE`** in a production static host, the client falls back to same-origin **`/api`**, which usually fails on Cloudflare Pages — see [Deployment](deploy.md).
