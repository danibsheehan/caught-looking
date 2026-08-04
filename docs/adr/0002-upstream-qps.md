# ADR 0002: Per-process MLB and Savant QPS caps

- **Status:** Accepted
- **Date:** 2026-08-04

## Context

Caught Looking fans out to third-party public APIs that are not under our control. Unbounded concurrency (cold cache, multi-instance Cloud Run, or a noisy client) can trigger upstream 429/503s or get the deployment blocked. Inbound HTTP rate limiting (`RATE_LIMIT_*`, keyed by `RemoteAddr`) protects the process from browser abuse but does not cap **outbound** fan-out after cache misses.

## Decision

Apply **token-bucket QPS limits per process** on outbound clients:

| Knob | Default | Role |
| --- | --- | --- |
| `MLB_MAX_QPS` | 20 | Max outbound GETs/sec to MLB Stats API |
| `SAVANT_MAX_QPS` | 5 | Max outbound GETs/sec to Baseball Savant (CSV; heavier) |
| `MLB_HTTP_TIMEOUT` | 15s | Per-attempt MLB timeout |
| `SAVANT_HTTP_TIMEOUT` | 30s | Per-attempt Savant timeout (CSV can be large) |

Setting a QPS env to `0` disables that bucket (used in tests). Prefer cache + singleflight + batch routes over raising QPS. Keep Cloud Run **`CLOUDRUN_MAX_INSTANCES`** low (default 2) so aggregate outbound budget stays bounded without a global rate coordinator.

## Consequences

- **Positive:** Predictable upstream load from one instance; Savant stays stricter than MLB; easy to tune via env without code changes.
- **Negative:** Limits are **per process** — N warm instances ≈ N× budget. No shared Redis/QPS coordinator (cost/complexity deferred).
- **Follow-ups (not required):** shared cache or a global limiter only if instance count or traffic forces it; prefer raising hit rate over raising QPS.
