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
| Skills docs (`check-skills-docs`) | `.cursor/skills/*/SKILL.md` vs `project-stack.mdc` Workflow skills + `AGENTS.md` playbooks |
| Frontend (`ci-local-frontend`) | `npm audit --audit-level=high`, `make check-openapi`, lint, `format:check`, typecheck, `test:coverage` + ≥50% line-rate gate, build |
| Backend (`ci-local-backend`) | `go vet`, `govulncheck`, `go test -race`, tests with coverage + ≥50% Cobertura gate, build |

Faster subsets when iterating (not a substitute before PR):

- `make check-stack-docs` — README / project-stack version drift only
- `make check-skills-docs` — skill directory vs routing-doc drift only
- `make check-openapi` — contract only
- `make test-backend` / `make test-frontend` — tests without full audit/coverage/build gate
- `make ci-local-frontend` / `make ci-local-backend` — one CI job

If OpenAPI fails, follow **`.cursor/skills/openapi-maintain/SKILL.md`**.

If the diff touches cache/QPS defaults, CORS/rate-limit/body-cap/security-header behavior, or the
OpenAPI workflow, also run **`adr-doc-sync-check`** — no automated check catches that drift.

Also: **`npx prettier --write`** on any frontend files you changed before `format:check` (see **`.cursor/rules/frontend-prettier.mdc`**).

### 2. PR description

When opening a PR, fill **`.github/pull_request_template.md`**. Path-based scaffolding
(Touches, suggested verify) from **PR guide** is helpful but mechanical — it cannot know *why*.
Draft **Summary** and **How to verify** by reading the actual diff: see **`pr-summary-draft`**.

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
