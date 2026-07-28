---
name: openapi-maintain
description: >-
  Keeps backend/apidocs/openapi.yaml aligned with Go handlers and ensures
  openapi-typescript output and api.compat stay in sync. Use when adding or changing
  API routes, JSON response shapes, query parameters, operationId, schemas, error
  responses, or when the user mentions OpenAPI, Redoc, Swagger, api:validate,
  api.generated.ts, api.compat, or a new endpoint contract.
---

# OpenAPI maintenance (caught-looking)

## When this applies

- Editing `backend/handlers/`, `backend/models/`, or `backend/apidocs/openapi.yaml`.
- Adding or changing `fetch…` helpers in `frontend/src/api/client.ts` or types in `frontend/src/types/api.compat.ts`.

## Order of work (same PR as the code change)

1. **Handlers / models** — JSON tags and status codes are the contract source for behavior.
2. **`backend/apidocs/openapi.yaml`** — paths, methods, `operationId`, request/response `$ref` schemas, query parameters, and documented errors match the handler.
3. From **`frontend/`**: `npm run api:types` then commit **`frontend/src/types/api.generated.ts`** if it changed.
4. **`frontend/src/types/api.compat.ts`** — add or adjust exports for new schemas or `QueryOf<operations['…']>` types the client uses.
5. **`frontend/src/api/client.ts`** — paths and query params match the spec and router.
6. **Done when**: **`make check-openapi`** passes (task-level). Before a PR, run **`make ci-local`** / **`.cursor/skills/pr-ready/SKILL.md`**.

## Spec conventions

- **`operationId`**: stable verb + resource style aligned with existing ops (e.g. compare neighboring paths in the yaml).
- **Errors**: document the JSON envelope `{"error":"<message>"}` for 4xx/5xx the handler actually returns (`respondAPIError` / upstream helpers).
- **Schemas**: property names must match Go `json` tags on **`models/`** types.

For scaffolding a full route end-to-end, see **`.cursor/skills/add-api-endpoint/SKILL.md`** when that skill is present.

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
