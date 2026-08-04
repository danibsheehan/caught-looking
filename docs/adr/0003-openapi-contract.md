# ADR 0003: OpenAPI as the frontend/backend contract

- **Status:** Accepted
- **Date:** 2026-08-04

## Context

The SPA and Go API evolve together. Hand-written TypeScript types drift from handler JSON; docs drift from reality. Reviewers and agents need a single place that defines paths, query params, status codes, and schemas.

## Decision

Treat **`backend/apidocs/openapi.yaml`** as the **source of truth** for HTTP shapes:

1. Handlers and `models/` JSON tags match the spec (same PR when the contract changes).
2. Frontend generates **`frontend/src/types/api.generated.ts`** via `openapi-typescript` (`npm run api:types`); do not hand-edit generated output.
3. App-facing stable names and awkward query shapes live in **`frontend/src/types/api.compat.ts`**.
4. **`frontend/src/api/client.ts`** calls paths consistent with the spec (and the Vite `/api` proxy).
5. CI enforces Redocly lint and generated-type drift: `make check-openapi` / `api:types:check`.
6. Human-readable docs: Redoc at [docs.caught-looking.com](https://docs.caught-looking.com/) from the same YAML.

How-to for agents: `.cursor/skills/openapi-maintain/SKILL.md` and `.cursor/skills/add-api-endpoint/SKILL.md`.

## Consequences

- **Positive:** FE/BE stay aligned; PR review can check the YAML; public Redoc stays accurate; typegen catches renames before runtime.
- **Negative:** Every JSON/path change needs a YAML + regen step; `api.compat` exists for edges OpenAPI expresses poorly.
- **Non-goal:** Code generation of Go handlers from OpenAPI (handlers remain hand-written for control over caching and upstream mapping).
