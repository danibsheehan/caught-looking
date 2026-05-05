## Summary

<!-- What changed and why (user-visible behavior, API, or data). -->

## How to verify

<!-- e.g. `make dev`, specific page/route, or “N/A” for tooling-only. -->

## Checklist

- [ ] `frontend`: `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm run build` succeed locally
- [ ] `backend`: `go vet ./...`, `go test ./...`, and `go build .` succeed locally (from `backend/`)
- [ ] API changes: `backend/apidocs/openapi.yaml` updated; `npm run api:types` run from `frontend/` and `api.generated.ts` committed if changed; `frontend/src/types/api.compat.ts` and `frontend/src/api/client.ts` updated as needed; `make check-openapi` passes
- [ ] No unintended secrets or local-only config committed
