# Load-smoke perf results

- **Status:** Auto-generated — do not hand-edit, your changes will be overwritten
- **Related:** [SLOs](slo.md), [`scripts/load-smoke.sh`](../scripts/load-smoke.sh), [`.github/workflows/perf-metrics.yml`](../.github/workflows/perf-metrics.yml)

**What this is:** a snapshot of the most recent [`make load-smoke`](../Makefile) run — cold-vs-warm
request latency (p50/p95, ms) at increasing concurrency, plus the singleflight coalescing proof,
run against a fixture upstream (no live MLB/Savant traffic) by a scheduled GitHub Actions workflow.
Regenerated weekly and on demand; a person still reviews and merges the PR it opens — see
[docs/automation.md](automation.md).

**Last updated:** 2026-08-31 · commit `e9169c7` · [workflow run](https://github.com/danibsheehan/caught-looking/actions/runs/33435539726)

## Latency sweep (ms)

```
N        cold-p50   cold-p95   warm-p50   warm-p95  
10       1750.0     2425.0     2.5        4.8       
40       1750.0     2425.0     2.5        4.8       
100      1750.0     2425.0     2.5        4.8       
500      1750.0     2425.0     2.5        4.8       
```

**Reading it:** cold latency clusters on the fixture's injected ~2000ms delay regardless of N
(wider than local's 400ms default — this run added headroom for CI-runner scheduling jitter; the
absolute number is an artifact of that test delay, not a real-world figure) — the flatness under
increasing concurrency is the point: coalesced followers wait on the same in-flight load as the
singleflight leader instead of each triggering a separate upstream call, so latency doesn't
degrade as concurrent traffic grows. Warm latency (served entirely from the in-process cache)
stays flat at single-digit milliseconds — comfortably inside the [SLO](slo.md) target of
p95 < 100ms for warm cache hits.

## Coalescing proof

Each level's cold burst confirmed a cache-miss delta of 1–3 (one singleflight leader, occasional
late-arriving races) and a coalesce count ≥ N/2; each warm burst confirmed a miss delta of 0 and
a hit delta ≥ N. See [`scripts/load-smoke.sh`](../scripts/load-smoke.sh) for the exact assertions.
