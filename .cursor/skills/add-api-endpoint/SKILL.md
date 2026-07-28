---
name: add-api-endpoint
description: >-
  Scaffolds a full caught-looking API endpoint end-to-end: Go models and handler,
  chi router, OpenAPI, generated TS types, api.compat, client fetch helper, optional
  hook/UI, and backend/frontend tests. Use when adding a new API route or endpoint,
  wiring a new backend path through the frontend, or when the user mentions new
  handler, new route, or expose an MLB/Savant-backed resource.
---

# Add an API endpoint (caught-looking)

Complete this checklist in **one PR** (or clearly stacked PRs). Do not stop after the Go handler.

## Checklist

Copy and track:

```
Endpoint progress:
- [ ] 1. models + handler
- [ ] 2. router
- [ ] 3. OpenAPI + make check-openapi
- [ ] 4. api.compat + client fetch…
- [ ] 5. hook / page (if UI needs it)
- [ ] 6. backend tests
- [ ] 7. frontend tests (client and/or hook/UI)
```

### 1. Models + handler

- Add or extend structs in **`backend/models/`** with `json` tags that will match OpenAPI.
- Implement the handler on **`handlers.Handlers`** in **`backend/handlers/`**.
- Validate path/query params; use **`respondAPIError`** for 400s.
- Prefer **`h.cache.GetOrLoad`** + **`h.mlb`** / Savant clients over ad-hoc HTTP (see **`.cursor/skills/caching-and-upstream-perf/SKILL.md`** when present).
- Map upstream failures with **`respondUpstreamError`** / **`respondGetOrLoadError`** — never return raw upstream `err.Error()` to clients.
- Follow **`.cursor/rules/backend-go.mdc`**.

### 2. Router

- Register the route in **`backend/router.go`** inside the rate-limited group (same pattern as existing GETs).
- Keep path prefixes consistent with how the Vite proxy strips `/api` and how **`frontend/src/api/client.ts`** builds paths.

### 3. OpenAPI + types

- Follow **`.cursor/skills/openapi-maintain/SKILL.md`** exactly:
  - Update **`backend/apidocs/openapi.yaml`**
  - `npm run api:types` → commit **`api.generated.ts`** if changed
  - Extend **`api.compat.ts`**
  - **`make check-openapi`**

### 4. Frontend client

- Add **`fetch…`** in **`frontend/src/api/client.ts`** via **`apiGet<T>`**, types from **`api.compat`**.
- Naming: `fetchResourceName` — align path segments with the router.
- Follow **`.cursor/rules/frontend-api.mdc`**.

### 5. Hook / UI (only if needed)

- Wrap client calls in **`frontend/src/hooks/`** using existing async patterns (**`useAsyncResource`**: AbortController, loading/error).
- Pages under **`frontend/src/pages/`**; reusable UI under **`components/`**. No raw `fetch` in components for app API data.
- New class names: BEM per **`.cursor/rules/frontend-bem.mdc`**.

### 6. Backend tests

- Follow **`.cursor/skills/backend-go-tests/SKILL.md`**: `newTestHandlers`, chi for URL params, validation / success / upstream failure.

### 7. Frontend tests

- Follow **`.cursor/skills/frontend-vitest-tests/SKILL.md`**: mock `api/client`, assert params; hook/UI tests as needed.
- Run Prettier on changed frontend files.

## Done when

- **Task done**: checklist above through tests + `make check-openapi` and focused backend/frontend tests for the change.
- **PR done**: **`make ci-local`** and **`.cursor/skills/pr-ready/SKILL.md`**.

## Anti-patterns

- Shipping handler-only without OpenAPI / client / tests.
- Hand-editing **`api.generated.ts`**.
- Calling `statsapi.mlb.com` directly from the frontend.
