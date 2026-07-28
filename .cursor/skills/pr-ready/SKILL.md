---
name: pr-ready
description: >-
  Runs caught-looking’s local CI-parity checks and prepares a pull request:
  OpenAPI validate/types, backend vet/govulncheck/test/build, frontend lint,
  Prettier, typecheck, test, and build, plus PR template fields. Use when the user
  asks to open a PR, prepare a pull request, pre-PR checks, make CI pass, or
  verify before merging.
---

# PR ready (caught-looking)

Run before opening or updating a PR. Prefer **repo-root Make targets** where they exist.

## Checklist

```
Pre-PR:
- [ ] Scope: only intended files; no secrets (.env, credentials)
- [ ] OpenAPI (if API touched)
- [ ] Backend CI parity
- [ ] Frontend CI parity
- [ ] PR template filled
```

### 1. OpenAPI (skip only if no API/contract change)

From repo root:

```bash
make check-openapi
```

If this fails, follow **`.cursor/skills/openapi-maintain/SKILL.md`**.

### 2. Backend

```bash
make test-backend
```

Equivalent to CI: `go vet`, `govulncheck`, `go test ./... -count=1`, `go build`.

### 3. Frontend

From **`frontend/`** (order matches CI):

```bash
npm run api:validate          # if not already via make check-openapi
npm run api:types:check
npm run lint
npm run format:check
npm run typecheck
npm run test:run              # or test:coverage when checking the 50% gate
npm run build
```

Also: **`npx prettier --write`** on any frontend files you changed (see **`.cursor/rules/frontend-prettier.mdc`**).

Optional coverage (CI enforces ≥50% line rate):

```bash
make cover-frontend
make cover-backend
```

### 4. PR description

Fill **`.github/pull_request_template.md`**:

- **Summary** — what changed and why
- **How to verify** — routes/pages to exercise, or `N/A` for tooling-only

Do not push or create the PR unless the user asked.

## Anti-patterns

- Opening a PR with failing `api:types:check` or format/lint.
- Skipping `make check-openapi` after handler/model/OpenAPI edits.
- Amending or force-pushing unless the user explicitly requests it.
