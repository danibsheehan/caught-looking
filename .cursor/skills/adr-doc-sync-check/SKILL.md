---
name: adr-doc-sync-check
description: >-
  Flags when a diff changes cache TTL/QPS defaults, CORS/rate-limit/body-cap/
  security-header behavior, or the OpenAPI workflow without also updating the
  matching ADR (docs/adr/0001, 0002, 0003) or docs/threat-model.md in the same
  change. Use before opening a PR that touches backend/config/config.go,
  backend/handlers/cache_ttl.go, backend/middleware/, frontend/public/_headers,
  or the OpenAPI contract workflow, or when asked to check if ADRs or the
  threat model need updating.
---

# ADR / threat-model sync check (caught-looking)

Unlike stack-docs (`check_stack_docs.py`) and skills-docs (`check_skills_docs.py`), there is no
script for this: whether a diff's TTL/QPS/CORS/security change is "material" enough to need an
ADR or threat-model update is a judgment call, not a regex-comparable fact. Today it's three
separate "please remember" notes buried in skill files:

- `caching-and-upstream-perf`: TTL/QPS default or settle-policy changes → **ADR 0001** / **0002**.
- `backend-http-security`: CORS/rate-limit/body-cap/probe/security-header changes → **`docs/threat-model.md`**.
- `openapi-maintain`: **workflow-level** (not per-endpoint) OpenAPI changes → **ADR 0003**.

This skill reads the diff and checks all three at once.

## Order of work

### 1. Read the diff

```bash
git diff main...HEAD
git diff --name-only main...HEAD
```

### 2. Check each trigger against the matching doc

For each row, if the diff touches the trigger in a way that changes a **default value or
behavior** (not a comment, rename, or test-only change), confirm the matching doc is also in
`git diff --name-only`. If not, flag it.

| Trigger (diff touches...) | Specifically | Matching doc |
|---|---|---|
| `backend/config/config.go` | Default values for `TTLStandings`, `TTLScores`, `TTLLiveScores`, `TTLStatcast`, `TTLPlayerSearch`, `CacheSweepInterval`, `CacheMaxEntries` | `docs/adr/0001-cache-ttls.md` |
| `backend/config/config.go` | Default values for `MLBMaxQPS`, `SavantMaxQPS`, `MLBHTTPTimeout`, `SavantHTTPTimeout` | `docs/adr/0002-upstream-qps.md` |
| `backend/handlers/cache_ttl.go` | Adaptive/settle-aware TTL logic (`cacheTTLForDateGames` and similar) | `docs/adr/0001-cache-ttls.md` |
| `backend/config/config.go` | `AllowedOrigins`, `RateLimitRequests`, `RateLimitWindow`, `HTTPMaxBodyBytes` | `docs/threat-model.md` |
| `backend/middleware/cors.go`, `ratelimit.go`, `max_body_bytes.go` | CORS allowlist logic, rate-limit trust (`RemoteAddr` vs. forwarded headers), body-cap enforcement | `docs/threat-model.md` |
| `backend/router.go` | A route joining/leaving the rate-limited group, or a new route mounted outside it (e.g. `/metrics`, `/health`, `/ready`) | `docs/threat-model.md` |
| `frontend/public/_headers` | CSP / nosniff / frame / referrer directives | `docs/threat-model.md` |
| `Makefile` (`check-openapi` target), `frontend/package.json` (`api:validate`/`api:types`/`api:types:check` scripts), `redocly.yaml`, `.github/workflows/ci.yml` (`api:validate`/`api:types:check` steps) | The typegen pipeline, lint config, or CI gate structure itself changing — **not** `backend/apidocs/openapi.yaml`, which only changes for routine per-endpoint schema edits | `docs/adr/0003-openapi-contract.md` |

### 3. Report

One list per PR: for each flagged trigger, name the file/field that changed and the doc that
looks out of date. If everything's already synced, say so briefly — don't pad the output.

This skill only flags; it doesn't draft the ADR/threat-model prose itself (that needs the actual
design rationale, which is a bigger judgment call than a doc-sync patch). Draft the update only
if asked.

## Anti-patterns

- Flagging cosmetic changes (renames, comments, formatting) in a trigger file as needing a doc
  update.
- Watching `backend/apidocs/openapi.yaml` itself for the ADR 0003 trigger — it only changes for
  routine per-endpoint schema edits, which need no ADR update. The typegen/lint/CI-gate files
  listed in the table are the real trigger.
- Editing the ADR or threat-model content unprompted — flag and stop, unless asked to draft it.

## Reference

- `docs/adr/0001-cache-ttls.md`, `docs/adr/0002-upstream-qps.md`, `docs/adr/0003-openapi-contract.md`.
- `docs/threat-model.md`.
- Complements **`pr-ready`** (run before opening a PR) and **`caching-and-upstream-perf`** /
  **`backend-http-security`** (the source of the "please remember" notes this skill enforces).
