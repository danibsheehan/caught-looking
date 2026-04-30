---
name: openapi-maintain
description: >-
  Keeps backend/apidocs/openapi.yaml aligned with Go handlers and ensures
  openapi-typescript output and api.compat stay in sync. Use when adding or changing
  API routes, JSON response shapes, query parameters, or when the user mentions
  OpenAPI, Redoc, Swagger, api:validate, or api.generated.ts.
---

# OpenAPI maintenance (caught-looking)

## When this applies

- Editing `backend/handlers/`, `backend/models/`, or `backend/apidocs/openapi.yaml`.
- Adding or changing `fetch…` helpers in `frontend/src/api/client.ts` or types in `frontend/src/types/api.compat.ts`.

## Checklist (same PR as the code change)

1. **`backend/apidocs/openapi.yaml`** — paths, methods, `operationId`, request/response `$ref` schemas, query parameters, and documented errors match the handler.
2. From **`frontend/`**: `npm run api:types` then commit **`frontend/src/types/api.generated.ts`** if it changed.
3. **`frontend/src/types/api.compat.ts`** — add or adjust exports for new schemas or `QueryOf<operations['…']>` types the client uses.
4. **`frontend/src/api/client.ts`** — paths and query params match the spec and router.
5. Local gate: **`make check-openapi`** (or `npm run api:validate` and `npm run api:types:check` from `frontend/`).

## Commands

| Goal | Command |
|------|---------|
| Lint spec | `cd frontend && npm run api:validate` |
| Regenerate TS | `cd frontend && npm run api:types` |
| CI parity (lint + drift) | `make check-openapi` from repo root |

## Anti-patterns

- Shipping handler or model JSON changes without updating `openapi.yaml`.
- Editing `api.generated.ts` by hand instead of regenerating.
- Drifting client paths from the spec or from `backend/router.go` / `main.go` mounts.

## References

- Spec: `backend/apidocs/openapi.yaml` · Redocly: `redocly.yaml` · CI: `.github/workflows/ci.yml` (`api:validate`, `api:types:check`).
