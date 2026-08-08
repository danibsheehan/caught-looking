---
name: backend-http-security
description: >-
  Applies caught-looking backend HTTP security conventions: input validation,
  generic upstream error responses, CORS and rate-limit middleware, safe logging,
  and govulncheck. Use when changing backend handlers, middleware, config, outbound
  MLB/Savant clients, auth/CORS/rate limits, or when the user mentions API security,
  SSRF, or hardening the Go API. Complements Cursor’s security-review subagent with
  project-specific patterns.
---

# Backend HTTP security (caught-looking)

Project-specific hardening for the chi API. For a diff-wide security pass, also use Cursor’s **`/review-security`** (or ask for a security review).

**Threat model:** **`docs/threat-model.md`** — assets, trust boundaries, controls, residual risks. Update it in the **same change** when CORS allowlisting, rate-limit trust (`RemoteAddr` vs forwarded headers), inbound body caps, outbound URL policy, generic upstream error responses, QPS/instance abuse assumptions, or SPA Pages security headers (`frontend/public/_headers` CSP / nosniff / frame / referrer) change. Do not duplicate the full threat table into this skill.

## Defaults already in the stack

- **CORS**: `middleware.CORS` — allowlist origins from config; methods GET/HEAD/OPTIONS; no credentials.
- **Rate limit**: `middleware.HTTPRateLimit` on the API group — keyed by **`Request.RemoteAddr`** (forwarded IP headers intentionally ignored unless a trusted proxy rewrites RemoteAddr).
- **Inbound body cap**: `middleware.MaxBodyBytes` globally — `HTTPMaxBodyBytes` / `HTTP_MAX_BODY_BYTES` (default 64 KiB; `0` disables). Oversize `Content-Length` → **413** `{"error":"request body too large"}`; `http.MaxBytesReader` still wraps `Body`.
- **Recovery / request IDs**: chi `Recoverer` + `RequestID`.
- **Outbound**: `MLBClient` / Savant clients use configured base URLs + path starting with `/` (not caller-controlled absolute URLs). QPS limits and HTTP timeouts from **`config.Config`**.

Extend behavior in **`backend/middleware/`** and **`backend/config/`** — do not scatter one-off middleware in handlers.

## Handler rules

1. **Validate before upstream**
   - Parse path/query IDs and seasons with clear 400s via **`respondAPIError(w, http.StatusBadRequest, "…")`**.
   - Reject empty/malformed ids the same way neighboring handlers do (table-driven tests expected).

2. **Never leak upstream errors to clients**
   - Use **`respondUpstreamError`** / **`respondGetOrLoadError`** / **`respondUpstreamJSONParseError`**.
   - Clients get generic messages (`bad gateway`, `gateway timeout`, `encode error`). Log detail server-side with **`request_id`**. The SPA reads **`X-Request-ID`** (CORS-exposed) into **`ApiError`** so users/support can correlate without leaking upstream bodies.

3. **Do not trust client-supplied upstream URLs**
   - Only call **`h.mlb.Get(ctx, path)`** (or Savant equivalents) with **server-built** paths.
   - Base URL comes from env/config (`MLB_BASE_URL`, `SAVANT_BASE_URL`), not request bodies/query.

4. **Cache keys**
   - Build keys from validated params only (no raw unsanitized query strings that could explode cardinality — player search already uses a dedicated short TTL).

5. **Logging**
   - Prefer **`log/slog`** with `request_id`, method, path, event. Avoid logging secrets or full PII; upstream body snippets already truncated in client errors — still do not echo them to HTTP responses.
   - Process metrics: **`GET /metrics`** (Go defaults + `caught_looking_*` counters/histograms) sits outside the rate-limited API group; informal targets in **`docs/slo.md`**; update **`docs/threat-model.md`** if scrape exposure or collectors change.

## Config / middleware changes

- Tightening CORS: update **`AllowedOrigins`** loading in **`config.Load`** and keep browser origins explicit.
- Rate limits: `RateLimitRequests` / `RateLimitWindow` (0 disables). Keep JSON 429 body shape: `{"error":"too many requests"}`.
- Body size: `HTTPMaxBodyBytes` / `HTTP_MAX_BODY_BYTES` (0 disables). Keep JSON 413 body shape: `{"error":"request body too large"}`.
- After middleware changes: add/adjust tests in **`backend/middleware/*_test.go`**.

## Verification

```bash
make test-backend   # includes govulncheck
```

CI also runs `npm audit --audit-level=high` on the frontend job.

## Anti-patterns

- Returning `err.Error()` from MLB/Savant failures in JSON.
- Disabling rate limit or CORS allow-all in production defaults without an explicit, reviewed reason.
- Hitting real `statsapi.mlb.com` from unit tests.
- Introducing cookie/credentialed CORS without a clear auth design (API is currently credential-free GETs).
- Changing the security posture above without updating **`docs/threat-model.md`**.
