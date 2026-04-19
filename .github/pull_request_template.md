## Summary

<!-- What changed and why (user-visible behavior, API, or data). -->

## How to verify

<!-- e.g. `make dev`, specific page/route, or “N/A” for tooling-only. -->

## Checklist

- [ ] `frontend`: `npm run lint`, `npm run typecheck`, and `npm run build` succeed locally
- [ ] `backend`: `go vet ./...`, `go test ./...`, and `go build .` succeed locally (from `backend/`)
- [ ] API changes: `frontend/src/types/api.d.ts` and `frontend/src/api/client.ts` updated if JSON or routes changed
- [ ] No unintended secrets or local-only config committed
