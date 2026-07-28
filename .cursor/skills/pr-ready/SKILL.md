---
name: pr-ready
description: >-
  Runs caught-looking’s local CI-parity checks and prepares a pull request via
  make ci-local (OpenAPI, audit, lint, format, typecheck, coverage gates, build,
  vet, govulncheck), plus PR template fields. Use when the user asks to open a PR,
  prepare a pull request, pre-PR checks, make CI pass, or verify before merging.
---

# PR ready (caught-looking)

Run before opening or updating a PR. Prefer **`make ci-local`** from the repo root.

## Checklist

```
Pre-PR:
- [ ] Scope: only intended files; no secrets (.env, credentials)
- [ ] make ci-local
- [ ] PR template filled
```

### 1. Local CI parity

```bash
make ci-local
```

Runs frontend then backend checks aligned with **`.github/workflows/ci.yml`**:

| Side | Includes |
|------|----------|
| Frontend (`ci-local-frontend`) | `npm audit --audit-level=high`, `make check-openapi`, lint, `format:check`, typecheck, `test:coverage` + ≥50% line-rate gate, build |
| Backend (`ci-local-backend`) | `go vet`, `govulncheck`, `go test -race`, tests with coverage + ≥50% Cobertura gate, build |

Faster subsets when iterating (not a substitute before PR):

- `make check-openapi` — contract only
- `make test-backend` / `make test-frontend` — tests without full audit/coverage/build gate
- `make ci-local-frontend` / `make ci-local-backend` — one CI job

If OpenAPI fails, follow **`.cursor/skills/openapi-maintain/SKILL.md`**.

Also: **`npx prettier --write`** on any frontend files you changed before `format:check` (see **`.cursor/rules/frontend-prettier.mdc`**).

### 2. PR description

Fill **`.github/pull_request_template.md`**:

- **Summary** — what changed and why
- **How to verify** — routes/pages to exercise, or `N/A` for tooling-only

Do not push or create the PR unless the user asked.

### 3. After merge (local cleanup)

When the PR is merged and the user is done with the branch (or asks to clean up):

```bash
git checkout main && git pull origin main
git branch -d <feature-branch>
```

Keep only **`main`** locally unless another branch is still in active use. Optionally `git fetch --prune` to drop stale remote-tracking refs.

## Anti-patterns

- Opening a PR without a green **`make ci-local`**.
- Skipping coverage gates by using only `make test-frontend` / `make test-backend` before PR.
- Amending or force-pushing unless the user explicitly requests it.
- Leaving merged feature branches checked out or lingering locally after the user asks to clean up.
