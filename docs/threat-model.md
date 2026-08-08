# Threat model — Caught Looking API

- **Scope:** Public Go API (`backend/`) that proxies and caches MLB Stats API and Baseball Savant for the React SPA.
- **Last updated:** 2026-08-08
- **Related:** [docs/adr/](adr/) (cache TTLs, QPS), [docs/slo.md](slo.md) (informal latency targets), [backend HTTP security skill](../.cursor/skills/backend-http-security/SKILL.md)

Structured request/upstream logs use **`log/slog`** (JSON from `main`) with **`request_id`**. Every response includes **`X-Request-ID`** (chi RequestID; CORS-exposed for cross-origin SPA). The SPA attaches that header to **`ApiError`** so user-visible alerts can be matched to server logs. Prometheus text exposition is at **`GET /metrics`** (Go defaults plus low-cardinality custom counters and latency histograms: cache hit/miss, singleflight coalesce, cache-load / HTTP / upstream durations, upstream 429/5xx).

## Assets

| Asset | Notes |
| --- | --- |
| API availability | Cloud Run service; abuse or upstream failure degrades the SPA |
| Upstream goodwill | MLB / Savant rate limits and ToS — not owned by us |
| In-process cache | Cached JSON/CSV bytes; no user PII by design |
| SPA origins | CORS allowlist; production apex + `www` + Pages previews |
| SPA static assets | Cloudflare Pages; browser XSS / clickjacking surface |
| Deploy credentials | GitHub Actions → WIF → GCP; Cloudflare token — never in the app |

## Trust boundaries

```text
Browser (untrusted)
    │  HTTPS GET (credential-free)
    │  SPA from Cloudflare Pages (+ security headers)
    ▼
Cloud Run API (trusted process)
    │  /health (liveness) · /ready (process invariants only)
    │  server-built paths only
    ▼
MLB Stats API / Baseball Savant (untrusted upstream)
```

- Clients are **unauthenticated**. There are no accounts, cookies, or API keys for end users.
- Upstream base URLs come from **config/env**, not from request parameters (no open SSRF via caller-controlled URLs).
- The SPA is served from **Cloudflare Pages**. Response headers (CSP, nosniff, frame denial, referrer, Permissions-Policy) come from **`frontend/public/_headers`** (Vite copies into `dist/`).
- **Probes:** `GET /health` = process alive; `GET /ready` = cache + MLB/Savant *clients* are constructed. Neither probe calls upstream — failing ready on MLB downtime would thrash Cloud Run scale-to-zero.

## Actors and threats

| Actor | Threat | Mitigations in place |
| --- | --- | --- |
| Anonymous scraper / bot | High request volume to API | Per-IP sliding window (`RATE_LIMIT_*`) on the API group; keyed by `Request.RemoteAddr` (forwarded IP headers **not** trusted unless a proxy rewrites `RemoteAddr`) |
| Anonymous client | Force expensive upstream fan-out | TTL cache + singleflight; outbound `MLB_MAX_QPS` / `SAVANT_MAX_QPS`; Cloud Run `max-instances` capped (default 2) |
| Anonymous client | Probe for error leakage / internals | Generic 502/504 JSON to clients; detail logged with `request_id` only |
| Anonymous client | Scrape process metrics | `GET /metrics` (Go defaults + custom `caught_looking_*` counters/histograms) is **outside** the rate-limit group like `/health`. Prefer network/IAM restriction on Cloud Run for production scrapes; keep custom labels low-cardinality (`result`, `upstream`, `class`, chi `route` patterns, status `code` class — never cache keys or raw paths with ids) |
| Anonymous client | Oversized inbound body (misuse / future POST) | Global `middleware.MaxBodyBytes` via `HTTP_MAX_BODY_BYTES` (default 64 KiB; `0` disables); early 413 when `Content-Length` exceeds the cap, plus `http.MaxBytesReader` on `Body`. Outbound bodies capped separately (`maxUpstreamBodyBytes`, 32 MiB) |
| Browser attacker | XSS / script injection against SPA | Pages CSP (`script-src 'self'`; no inline scripts). Google Fonts allowlisted for `style-src` / `font-src`. `connect-src` limited to `'self'` + Cloud Run `https://*.a.run.app` (matches `VITE_API_BASE`) |
| Browser attacker | Clickjacking / MIME sniffing / referrer leak | `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |
| Misconfigured CORS | Cross-origin browser calls from unexpected sites | Explicit `ALLOWED_ORIGINS` / deploy `CORS_ALLOWED_ORIGINS` allowlist |
| Compromised dependency | RCE / supply chain | CI `govulncheck` (Go) and `npm audit --audit-level=high` (frontend); optional Syft SBOM artifact on CI; Dependabot |
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
4. **Upstream outages** — reflected as generic gateway errors; no paid APM required for this model. Contract Playwright proves the happy path; **chaos contract** (`make test-e2e-chaos`) injects fixture 429/5xx/slow via `e2e-upstream` `PUT /_chaos` so degradation stays demoable without live MLB.
5. **SPA CSP `style-src 'unsafe-inline'`** — React/Recharts inline styles require it; script injection is still blocked by `script-src 'self'`. Tighten later with nonces/hashes if the style surface shrinks.
6. **API host in CSP** — `connect-src` allowlists Cloud Run `https://*.a.run.app`. A custom API domain must be added to `frontend/public/_headers` in the same change as `VITE_API_BASE`.
7. **Probe misuse** — wiring `/ready` to live MLB checks would invent outages and fight scale-to-zero; keep readiness process-local only.

## Verification expectations

When changing CORS, rate limits, inbound body caps, upstream clients, cache keys, SPA Pages security headers (`frontend/public/_headers`), or probe semantics (`/health` / `/ready`), update this document if the threat or control changes, and run:

```bash
make test-backend   # includes govulncheck
# After SPA header changes:
cd frontend && npm run build && test -f dist/_headers
```
