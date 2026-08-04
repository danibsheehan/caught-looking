# Threat model — Caught Looking API

- **Scope:** Public Go API (`backend/`) that proxies and caches MLB Stats API and Baseball Savant for the React SPA.
- **Last updated:** 2026-08-04
- **Related:** [docs/adr/](adr/) (cache TTLs, QPS), [backend HTTP security skill](../.cursor/skills/backend-http-security/SKILL.md)

Structured request/upstream logs use **`log/slog`** (JSON from `main`). Prometheus text exposition is at **`GET /metrics`**.

## Assets

| Asset | Notes |
| --- | --- |
| API availability | Cloud Run service; abuse or upstream failure degrades the SPA |
| Upstream goodwill | MLB / Savant rate limits and ToS — not owned by us |
| In-process cache | Cached JSON/CSV bytes; no user PII by design |
| SPA origins | CORS allowlist; production apex + `www` + Pages previews |
| Deploy credentials | GitHub Actions → WIF → GCP; Cloudflare token — never in the app |

## Trust boundaries

```text
Browser (untrusted)
    │  HTTPS GET (credential-free)
    ▼
Cloud Run API (trusted process)
    │  server-built paths only
    ▼
MLB Stats API / Baseball Savant (untrusted upstream)
```

- Clients are **unauthenticated**. There are no accounts, cookies, or API keys for end users.
- Upstream base URLs come from **config/env**, not from request parameters (no open SSRF via caller-controlled URLs).

## Actors and threats

| Actor | Threat | Mitigations in place |
| --- | --- | --- |
| Anonymous scraper / bot | High request volume to API | Per-IP sliding window (`RATE_LIMIT_*`) on the API group; keyed by `Request.RemoteAddr` (forwarded IP headers **not** trusted unless a proxy rewrites `RemoteAddr`) |
| Anonymous client | Force expensive upstream fan-out | TTL cache + singleflight; outbound `MLB_MAX_QPS` / `SAVANT_MAX_QPS`; Cloud Run `max-instances` capped (default 2) |
| Anonymous client | Probe for error leakage / internals | Generic 502/504 JSON to clients; detail logged with `request_id` only |
| Anonymous client | Scrape process metrics | `GET /metrics` (Prometheus default collectors) is **outside** the rate-limit group like `/health`. Prefer network/IAM restriction on Cloud Run for production scrapes; avoid high-cardinality custom labels |
| Anonymous client | Oversized inbound body (future POST / misuse) | Routes are mostly GET today; **inbound** body size middleware is a planned follow-up. Outbound bodies already capped (`maxUpstreamBodyBytes`, 32 MiB) |
| Misconfigured CORS | Cross-origin browser calls from unexpected sites | Explicit `ALLOWED_ORIGINS` / deploy `CORS_ALLOWED_ORIGINS` allowlist |
| Compromised dependency | RCE / supply chain | CI `govulncheck` (Go) and `npm audit --audit-level=high` (frontend); Dependabot |
| Operator / deploy | Accidental spend | Scale-to-zero Cloud Run, low max instances, Artifact Registry cleanup; GCP billing budget recommended (ops, not code) |

## Explicit non-goals

- **Authentication / authorization** — not part of the product surface.
- **Protecting MLB/Savant data confidentiality** — data is already public; we protect *availability* and *upstream courtesy*.
- **Multi-tenant isolation** — single public app.
- **Shared cache / global QPS across instances** — deferred (cost); see ADR 0002 residual risk.

## Residual risks

1. **Per-process QPS × instance count** — two warm Cloud Run instances can approach 2× outbound budget. Keep max instances low or add a shared limiter only if traffic requires it.
2. **Unauthenticated read API** — anyone can call Cloud Run URL directly; rate limits and QPS are the primary brakes.
3. **In-memory cache only** — stampede risk on cold start / new instance; singleflight helps within one process only.
4. **No inbound body limit middleware yet** — low urgency while handlers are GET-only; add before introducing large POST bodies.
5. **Upstream outages** — reflected as generic gateway errors; no paid APM required for this model.

## Verification expectations

When changing CORS, rate limits, upstream clients, or cache keys, update this document if the threat or control changes, and run:

```bash
make test-backend   # includes govulncheck
```
