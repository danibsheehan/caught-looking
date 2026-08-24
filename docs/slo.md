# Service level objectives (informal)

- **Status:** Living document (not a paid SLA)
- **Last updated:** 2026-08-13
- **Related:** [docs home](README.md), [Cost and scale](../README.md#cost-and-scale-tradeoffs), [ADR 0001](adr/0001-cache-ttls.md), [ADR 0002](adr/0002-upstream-qps.md), [threat model](threat-model.md), [deploy](deploy.md)

**Who this is for:** Contributors and operators who want a shared sense of “fast enough” — and anyone curious how we talk about performance without a paid monitoring product.

**In plain English:** When the answer is already in memory on a warm server, we aim for a snappy response. When we have to ask MLB or Savant, speed depends on them. We also watch that we aren’t getting rate-limited by upstream. None of this is a contractual SLA; it’s a living checklist tied to numbers we can scrape from **`GET /metrics`**.

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

## Production alerting (free tier)

Everything above is ad-hoc — someone has to think to look. Cloud Run and Cloud Monitoring cover
the "is it actually down" question automatically, at **`$0`** for this app's traffic, without a
paid APM or exporting `caught_looking_*` metrics anywhere:

1. **Uptime check** — Cloud Monitoring → *Uptime checks* → HTTPS GET against the deployed API's
   `/health` (liveness) or `/ready` (dependency wiring; still never calls MLB/Savant — see
   [threat model](threat-model.md)). A single check on a several-minute interval sits well inside
   Cloud Monitoring's free tier; see [current limits](https://cloud.google.com/stackdriver/pricing)
   rather than trusting a number here to stay accurate.
2. **Alert policy on that check** — *Alerting* → *Create policy* → condition: the uptime check's
   failure count → notification channel: **email** (free; no SMS/Slack integration needed).
   Same "notify-only" spirit as the [billing budget alert](deploy.md#one-time-google-cloud-setup) —
   this tells a human, it doesn't try to auto-remediate.
3. **Optional — Cloud Run's built-in metrics** (request count, latency, 5xx rate, instance count)
   are collected automatically with no setup and no additional cost, since they come from the
   platform, not the app. An alert policy on 5xx rate or on instance count sitting at
   `CLOUDRUN_MAX_INSTANCES` (traffic spike / possible abuse — see
   [Cost and scale tradeoffs](../README.md#cost-and-scale-tradeoffs)) is a reasonable second
   policy once the uptime check is in place.

Deliberately **not** doing: exporting `caught_looking_*` histograms to Cloud Monitoring (would
need a sidecar/exporter — real infra, not a checkbox) or log-based alerting on individual error
lines (more setup than this app's traffic currently justifies). Revisit if traffic or incident
history says otherwise.

## Coalesce proof + latency sweep (`make load-smoke`)

Unit tests cover singleflight with a few goroutines; this script turns the **cost claim** into a measurement against fixture MLB (no live upstream, no paid load tool) — both a pass/fail coalescing proof and cold-vs-warm request latency read off the `http_request_duration_seconds` histogram:

```bash
make load-smoke
# optional: sweep specific concurrency levels instead of the 10/40/100/500 default
LOAD_SMOKE_LEVELS="10 40 100 200" make load-smoke
# optional: single level (back-compat)
LOAD_SMOKE_N=80 make load-smoke
```

What it does, per concurrency level N in the sweep (default **10, 40, 100, 500**, each against its own cache key so every level's cold burst is a genuine miss):

1. Boots `e2e-upstream` with a short **slow** chaos delay on `/standings` so concurrent cold misses overlap in flight (booted once, reused across all levels).
2. Boots the Go API pointed at that fixture (dedicated ports, rate limits off).
3. **Cold burst** of N concurrent `GET /standings` — asserts miss delta is small (≈1) and `cache_coalesce_total` rises by at least N/2; also computes cold p50/p95 latency (ms) from the `/metrics` delta.
4. **Warm burst** of N — asserts miss delta 0 and hit delta ≥ N; also computes warm p50/p95 latency.

Ends with a summary table across levels, e.g.:

```
N        cold-p50   cold-p95   warm-p50   warm-p95
10       375.0      487.5      2.5        4.8
40       375.0      487.5      2.5        4.8
100      375.0      487.5      2.5        4.8
500      375.0      487.5      2.5        4.8
```

(measured locally; cold numbers cluster on the fixture's injected 400ms delay because coalesced
followers wait on the same in-flight load as the leader, so their observed latency tracks the
leader's regardless of N — the histogram's fixed bucket boundaries round nearby values together)

Cold latency is dominated by the fixture's injected 400ms delay (by design, to force overlap) — the number to watch there is that it stays roughly flat as N grows, evidence that singleflight is sharing one upstream call rather than N. Warm p95 is the number to compare against the `docs/slo.md` warm-cache-hit target (<100ms) above.

Script: [`scripts/load-smoke.sh`](../scripts/load-smoke.sh). This is a local demo / CI-optional check, not a production soak.

A scheduled GitHub Actions workflow ([`perf-metrics.yml`](../.github/workflows/perf-metrics.yml))
runs this same sweep weekly (and on demand) and keeps [`docs/perf-results.md`](perf-results.md)
up to date, so the latest numbers are visible without needing to run anything locally.

## When to revisit architecture

Same triggers as the README cost table — not vanity metrics:

- Warm instance count or cold-start stampede forces a **shared L2 cache**
- Aggregate `max-instances × QPS` risks sustained upstream **429**s
- Latency SLOs require **`CLOUDRUN_MIN_INSTANCES` > 0** (accept spend to keep the in-memory cache warm)

Until then, defend in-process TTL cache + singleflight + QPS caps as the intentional `$0` design. Re-run **`make load-smoke`** after cache/coalesce changes.
