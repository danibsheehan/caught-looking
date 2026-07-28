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

## Backend cache

- Use **`services.TTLCache`** on **`Handlers`** (`h.cache`). Prefer **`GetOrLoad(ctx, key, ttl, load)`** so concurrent misses share one upstream call (**singleflight**). The load runs with a context **detached from request cancel** so one aborted client does not fail peers.
- Adaptive TTLs (e.g. date scoreboard settled vs live): use **`GetOrLoadWithTTL`** so the load returns `(body, ttl, err)`.
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
| `GameBoxscore` | `GetOrLoadWithTTL` | settle-aware (`cacheTTLForGameStatus`) | Phase 2 |
| `GameTimeline` | `GetOrLoadWithTTL` | settle-aware via linescore status | Phase 2 |
| `PlayerSearch` | `GetOrLoad` | `TTLPlayerSearch` | Phase 1 |
| `Standings` / `Teams` / platoon / compare / year-by-year / season-stats / current-team / divisions | `GetOrLoad` | season aggregates → `TTLStandings` | Phase 1–2 |
| Schedule / record timeline / batch | `GetOrLoad` | `cacheTTLForSeason` (past → standings, current → scores) | Phase 2 |
| Statcast / league baseline | `GetOrLoad` | varies | already coalesced |

## Upstream clients

- **Always** go through **`h.mlb`** / Savant client helpers — never `http.Get` to statsapi from handlers.
- **QPS**: `MLBMaxQPS` (default 20), `SavantMaxQPS` (default 5); per-attempt timeouts `MLBHTTPTimeout` / `SavantHTTPTimeout`. Tests use `NewMLBClient(url, 0, …)` (unlimited).
- **Avoid N+1**: batch when a batch route exists (e.g. record-timelines batch, current-teams). Inside `GetOrLoad`, fan-out carefully; reuse nested cache keys for shared pieces (see league baseline helpers).

## Frontend

- Debounce user-driven search (e.g. **320ms** in `PlayerPicker`) so typing does not stampede `/players/search`.
- Hooks: abort in-flight work on cleanup (**`AbortController`** via **`useAsyncResource`** and similar).
- Do not add `useMemo`/`useCallback` by default; follow existing React patterns in the repo.

## Verification

- Handler/cache tests: **`.cursor/skills/backend-go-tests/SKILL.md`**
- Load-ish sanity: hit the new path twice locally and confirm the second response is fast / no duplicate upstream in logs when cached.

## Anti-patterns

- Ad-hoc `map` caches in handlers instead of `TTLCache`.
- Response-body `cache.Get` + `cache.Set` without `GetOrLoad` / `GetOrLoadWithTTL` (thundering herd on concurrent misses).
- Caching without TTL (or with hour-long TTL on live game data).
- Parallel unbounded MLB calls per request without QPS awareness or coalescing.
- Calling the real MLB API from unit tests.
