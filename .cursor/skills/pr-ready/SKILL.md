---
name: pr-ready
description: >-
  Runs caught-looking’s local CI-parity checks and prepares a pull request via
  make ci-local (stack docs, OpenAPI, audit, lint, format, typecheck, coverage
  gates, build, vet, govulncheck), plus PR template fields. Use when the user asks
  to open a PR, prepare a pull request, pre-PR checks, make CI pass, or verify
  before merging.
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

Runs stack-docs drift, then frontend then backend checks aligned with **`.github/workflows/ci.yml`**:

| Side | Includes |
|------|----------|
| Stack docs (`check-stack-docs`) | README badges / Prerequisites / Tech stack + `project-stack.mdc` vs `package.json`, `go.mod`, CI Node/Go |
| Frontend (`ci-local-frontend`) | `npm audit --audit-level=high`, `make check-openapi`, lint, `format:check`, typecheck, `test:coverage` + ≥50% line-rate gate, build |
| Backend (`ci-local-backend`) | `go vet`, `govulncheck`, `go test -race`, tests with coverage + ≥50% Cobertura gate, build |

Faster subsets when iterating (not a substitute before PR):

- `make check-stack-docs` — README / project-stack version drift only
- `make check-openapi` — contract only
- `make test-backend` / `make test-frontend` — tests without full audit/coverage/build gate
- `make ci-local-frontend` / `make ci-local-backend` — one CI job

If OpenAPI fails, follow **`.cursor/skills/openapi-maintain/SKILL.md`**.

Also: **`npx prettier --write`** on any frontend files you changed before `format:check` (see **`.cursor/rules/frontend-prettier.mdc`**).

### 2. PR description

When opening a PR, fill **`.github/pull_request_template.md`**. Path-based scaffolding
(Touches, suggested verify) from **PR guide** is helpful — still write **Summary** yourself:

- **Summary** — lead with **why** (motivation / problem this solves), then what changed for
  users / API / data. Prefer 1–3 short bullets. Do **not** stop at a file list or commit subjects.
  - Weak: `Update chart-frame CSS and TeamWinsBarChart className.`
  - Stronger: `Charts nested under panels needed long descendant selectors for width/margin;
    make chart-frame own that spacing so wins/scatter/leaders shells stay consistent.`
- **How to verify** — user-facing steps (routes/pages, expected behavior), or `N/A` for
  tooling-only. Keep or edit any auto-suggested commands as needed.

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
