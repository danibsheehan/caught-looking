# Service level objectives (informal)

- **Status:** Living document (not a paid SLA)
- **Last updated:** 2026-08-08
- **Related:** [Cost and scale](../README.md#cost-and-scale-tradeoffs), [ADR 0001](adr/0001-cache-ttls.md), [ADR 0002](adr/0002-upstream-qps.md), [threat model](threat-model.md)

Caught Looking is a **best-effort** public read proxy on Cloud Run scale-to-zero. These targets interpret **`GET /metrics`** so we can tell warm cache-hit latency from cold upstream work — without a paid APM.

## Signals (`GET /metrics`)

| Intent | Metric | Labels (low-cardinality) |
| --- | --- | --- |
| Inbound latency | `caught_looking_http_request_duration_seconds` | `route` = chi pattern (e.g. `/standings`), `code` = `2xx`\|`4xx`\|`5xx` |
| Cache miss cost | `caught_looking_cache_load_duration_seconds` | `result` = `ok`\|`error` (singleflight leader only) |
| Upstream RTT | `caught_looking_upstream_http_duration_seconds` | `upstream` = `mlb`\|`savant` (per attempt, including retries) |
| Hit / miss volume | `caught_looking_cache_requests_total` | `result` = `hit`\|`miss` |
| Coalesce | `caught_looking_cache_coalesce_total` | — |
| Upstream pain | `caught_looking_upstream_http_total` | `upstream`, `class` = `429`\|`5xx` |

Never label metrics with cache keys, player ids, or raw URL paths — cardinality becomes a support cost.

## Targets (aspirational)

| Objective | Target | How to read it |
| --- | --- | --- |
| Warm cache-hit p95 (JSON API routes) | **< 100ms** | `http_request_duration_seconds` on a warm instance after traffic has filled the in-process cache |
| Cold / miss-dominated p95 | **Informational** | Dominated by MLB/Savant; compare `cache_load_duration_seconds` and `upstream_http_duration_seconds` |
| Steady-state cache hit ratio | **High** for standings / season aggregates | `hit / (hit + miss)` after warm-up; live boxscore/timeline intentionally miss more often (short TTL) |
| Upstream courtesy | **No sustained 429 climb** | `upstream_http_total{class="429"}` rate vs traffic; revisit QPS / `max-instances` if burning (ADR 0002) |
| Availability | **Best-effort** | Scale-to-zero implies cold-start refill; not an uptime SLO product |

Error “budget” here is informal: rising `code="5xx"` share on inbound histograms **without** a matching upstream outage is a bug; matching upstream 5xx/429 is residual risk already named in the threat model.

## Local inspection

```bash
make dev
# elsewhere:
curl -s http://127.0.0.1:8080/metrics | grep '^caught_looking_'
```

Useful PromQL-shaped questions (any Prometheus-compatible scraper, including ad-hoc):

- Warm hit path: histogram quantile on `http_request_duration_seconds{code="2xx"}` excluding `/metrics` / `/health` / `/ready` if scrapes/probes dominate.
- Miss cost: quantile on `cache_load_duration_seconds{result="ok"}`.
- Hit ratio: `rate(caught_looking_cache_requests_total{result="hit"}[5m]) / rate(caught_looking_cache_requests_total[5m])`.

## Coalesce proof (`make load-smoke`)

Unit tests cover singleflight with a few goroutines; this script turns the **cost claim** into a measurement against fixture MLB (no live upstream, no paid load tool):

```bash
make load-smoke
# optional: LOAD_SMOKE_N=80 make load-smoke
```

What it does:

1. Boots `e2e-upstream` with a short **slow** chaos delay on `/standings` so concurrent cold misses overlap in flight.
2. Boots the Go API pointed at that fixture (dedicated ports, rate limits off).
3. **Cold burst** of N concurrent `GET /standings` — asserts miss delta is small (≈1) and `cache_coalesce_total` rises by at least N/2.
4. **Warm burst** of N — asserts miss delta 0 and hit delta ≥ N.

Script: [`scripts/load-smoke.sh`](../scripts/load-smoke.sh). This is a local demo / CI-optional check, not a production soak.

## When to revisit architecture

Same triggers as the README cost table — not vanity metrics:

- Warm instance count or cold-start stampede forces a **shared L2 cache**
- Aggregate `max-instances × QPS` risks sustained upstream **429**s
- Latency SLOs require **`CLOUDRUN_MIN_INSTANCES` > 0** (accept spend to keep the in-memory cache warm)

Until then, defend in-process TTL cache + singleflight + QPS caps as the intentional `$0` design. Re-run **`make load-smoke`** after cache/coalesce changes.
