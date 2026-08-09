# ADR 0001: Adaptive and named cache TTLs

- **Status:** Accepted
- **Date:** 2026-08-04

**In plain English:** We remember answers for a set time so we don’t ask MLB or Baseball Savant the same question every second. Live games stay fresher; finished games and season tables can sit longer. If many people ask at once for something we don’t have yet, we fetch once and share the result (**singleflight**).

## Context

The API is a public read proxy in front of MLB Stats API and Baseball Savant. Upstream latency and rate limits dominate reliability. Responses are cached in-process (`services.TTLCache` with `GetOrLoad` / `GetOrLoadWithTTL` and singleflight). Live game data must refresh often; settled history and season aggregates should not.

## Decision

Use **named TTLs** from `config.Config` (overridable via env) plus **adaptive helpers** in `handlers/cache_ttl.go` that pick a TTL from game/date/season settle state:

| Knob | Default | Typical use |
| --- | --- | --- |
| `TTLLiveScores` (`CACHE_TTL_LIVE_SCORES`) | 45s | Today / unsettled scoreboards; in-progress boxscore and timeline |
| `TTLScores` (`CACHE_TTL_SCORES`) | 5m | General scores-ish and current-season schedule/record shapes |
| `TTLStandings` (`CACHE_TTL_STANDINGS`) | 1h | Standings, settled historical date boards, completed-season aggregates |
| `TTLStatcast` (`CACHE_TTL_STATCAST`) | 6h | Savant Statcast CSV per game (rarely changes after final) |
| `TTLPlayerSearch` (`CACHE_TTL_PLAYER_SEARCH`) | 3m | Name-search keys (unbounded query cardinality) |

Adaptive policy (summary):

- **Date games:** future or today-with-unsettled → live TTL; settled today → scores TTL; settled past dates → standings TTL.
- **Single game boxscore/timeline:** settled status → standings TTL; otherwise live TTL.
- **Season-scoped schedule/timelines:** completed calendar years → standings TTL; current/future → scores TTL.

Memory is bounded with `CACHE_MAX_ENTRIES` (default 2000) and a background sweeper (`CACHE_SWEEP_INTERVAL`).

## Consequences

- **Positive:** Live UIs stay fresh without hammering MLB; historical and Statcast payloads amortize cost across clients; concurrent misses coalesce via singleflight.
- **Negative:** In-process only — Cloud Run instances do not share cache; cold starts refill upstream. Stale windows are intentional (e.g. up to ~1h for standings).
- **Follow-ups (not required):** optional shared L2 cache if `max-instances` grows; SPA GameDetail polls boxscore/timeline at the live TTL while unsettled (pauses when the tab is hidden; Statcast stays one-shot at the Statcast TTL). Local proof that concurrent misses coalesce: **`make load-smoke`** (see `docs/slo.md`).
- **HTTP Cache-Control:** successful cached JSON responses set `Cache-Control` from the entry TTL (or remaining TTL on hit) via `writeJSONBytes` / `cacheControlForTTL`:
  - Non-positive TTL → `private, no-store`.
  - Live / near-live (TTL ≤ 60s, covering default `TTLLiveScores`) → `public, max-age=<seconds>` only, so scoreboards do not linger past the intentional refresh cadence.
  - Settled aggregates (TTL > 60s: scores, standings, Statcast, player search, etc.) → `public, max-age=<seconds>, stale-while-revalidate=<seconds>, stale-if-error=<min(2×seconds, 86400)>`. Browsers/intermediaries may reuse a fresh-enough response while revalidating, and keep serving it briefly if origin errors — without a shared CDN or Redis in front of Cloud Run.
