---
name: caching-and-upstream-perf
description: >-
  Guides TTLCache, GetOrLoad/singleflight, MLB/Savant QPS limits, and frontend
  debounce patterns for caught-looking. Use when adding cached handler responses,
  tuning TTLs or cache caps, reducing upstream fan-out, changing MLBMaxQPS /
  SavantMaxQPS, or when the user mentions performance, caching, rate limits, or
  N+1 MLB/Savant calls.
---

# Caching and upstream performance (caught-looking)

Most latency and reliability risk is **outbound MLB/Savant**, not React render. Prefer cache + coalescing + QPS caps over micro-optimizing UI.

**Why (ADRs):** named TTLs and adaptive settle policy — **`docs/adr/0001-cache-ttls.md`**; outbound QPS/timeouts — **`docs/adr/0002-upstream-qps.md`**. This skill is how-to; update those ADRs in the **same change** when defaults in `backend/config/config.go`, adaptive helpers in `backend/handlers/cache_ttl.go`, or QPS/timeout knobs change materially. Do not paste ADR tables into the README.

## Backend cache

- Use **`services.TTLCache`** on **`Handlers`** (`h.cache`). Prefer **`GetOrLoad(ctx, key, ttl, load)`** so concurrent misses share one upstream call (**singleflight**). The load runs with a context **detached from request cancel** so one aborted client does not fail peers. Outcomes increment low-cardinality Prometheus counters (`caught_looking_cache_requests_total{result}`, `caught_looking_cache_coalesce_total`); miss `load()` duration is observed on `caught_looking_cache_load_duration_seconds{result}` — scraped at **`GET /metrics`** (see **`docs/slo.md`**).
- Adaptive TTLs (e.g. date scoreboard settled vs live): use **`GetOrLoadWithTTL`** so the load returns `(body, ttl, err)`.
- **`GetOrLoad` / `GetOrLoadWithTTL`** return `(body, ttl, err)` — on hit, `ttl` is remaining time until expiry; on miss, the TTL used for `Set`. Pass that duration to **`writeJSONBytes(w, body, ttl)`** so responses get `Cache-Control: public, max-age=…` aligned with settle state (see ADR 0001).
- Map failures with **`respondGetOrLoadError`**. Do **not** use naked `Get`+`Set` for response bodies — that races under concurrent misses.
- **Keys**: stable, explicit strings from validated params (include season/ids/resource). Avoid unbounded raw query text; player search uses **`TTLPlayerSearch`**.
- **TTLs** (from **`config.Config`** — pick the closest existing knob; add a named TTL only if none fit):

  | Kind | Typical field | Default idea |
  |------|---------------|--------------|
  | Standings / season aggregates | `TTLStandings` | ~1h |
  | General scores / box-ish | `TTLScores` | ~5m |
  | Live / today scoreboard | `TTLLiveScores` | ~45s |
  | Statcast CSV | `TTLStatcast` | ~6h |
  | Player name search | `TTLPlayerSearch` | ~3m |

- **Memory**: sweeper (`CacheSweepInterval`) + **`CacheMaxEntries`** (default 2000). Do not cache huge unique keys without a short TTL or cap awareness.
- Gzip is enabled in the router for JSON/yaml — keep large Statcast responses cached as bytes you already marshal once.

### Handler cache adoption (Phase 0 inventory)

| Route / helper | Pattern | TTL | Notes |
|----------------|---------|-----|-------|
| `PlayersCompare` | `GetOrLoad` | `TTLScores` | Phase 1 |
| `GamesForDate` | `GetOrLoadWithTTL` | adaptive via `cacheTTLForDateGames` | Phase 1 |
| `GameBoxscore` / `GameTimeline` | `GetOrLoadWithTTL` + nested `mlb-boxscore-raw` | settle-aware | Phase 2–3 |
| `PlayerSearch` | `GetOrLoad` | `TTLPlayerSearch` | Phase 1 |
| Standings / Teams / platoon / compare / year-by-year / season-stats / current-team / divisions / leaders | `GetOrLoad` | season aggregates → `TTLStandings` | Phase 1–2 |
| Schedule / record timeline / batch | `GetOrLoad` | `cacheTTLForSeason` (past → standings, current → scores) | Phase 2 |
| Statcast / league baseline | `GetOrLoad` | varies; year-by-year league fan-out capped | Phase 3 |

## Upstream clients

- **Always** go through **`h.mlb`** / Savant client helpers — never `http.Get` to statsapi from handlers.
- **QPS**: `MLBMaxQPS` (default 20), `SavantMaxQPS` (default 5); per-attempt timeouts `MLBHTTPTimeout` / `SavantHTTPTimeout`. Tests use `NewMLBClient(url, 0, …)` (unlimited). Each upstream HTTP 429 or 5xx (per attempt, including retries) increments `caught_looking_upstream_http_total{upstream,class}`; each attempt observes `caught_looking_upstream_http_duration_seconds{upstream}`.
- **Avoid N+1**: batch when a batch route exists (e.g. record-timelines batch, current-teams). Inside `GetOrLoad`, fan-out carefully; reuse nested cache keys for shared pieces (see league baseline helpers, `fetchGameBoxscoreRaw`, `fetchSavantGameCSV`).
- **Cap parallel upstream work**: year-by-year league baselines use a semaphore (`yearByYearLeagueConcurrency`); record-timeline batch uses `batchTimelineConcurrency`.

## Frontend

- Debounce user-driven search (e.g. **320ms** in `PlayerPicker`) so typing does not stampede `/players/search`.
- Hooks: abort in-flight work on cleanup (**`AbortController`** via **`useAsyncResource`** and similar).
- Do not add `useMemo`/`useCallback` by default; follow existing React patterns in the repo.

## Verification

- Handler/cache tests: **`.cursor/skills/backend-go-tests/SKILL.md`**
- Load-ish sanity: hit the new path twice locally and confirm the second response is fast / no duplicate upstream in logs when cached.
- Concurrent coalesce proof: **`make load-smoke`** (`scripts/load-smoke.sh`) — N clients on fixture `/standings`, asserts `caught_looking_cache_*` deltas (cold coalesce, warm hits). Documented in **`docs/slo.md`**.

## Anti-patterns

- Ad-hoc `map` caches in handlers instead of `TTLCache`.
- Response-body `cache.Get` + `cache.Set` without `GetOrLoad` / `GetOrLoadWithTTL` (thundering herd on concurrent misses).
- Caching without TTL (or with hour-long TTL on live game data).
- Parallel unbounded MLB calls per request without QPS awareness or coalescing.
- Calling the real MLB API from unit tests.
- Changing TTL/QPS defaults or settle policy without updating **ADR 0001** / **ADR 0002**.
