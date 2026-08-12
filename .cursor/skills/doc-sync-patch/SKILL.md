---
name: doc-sync-patch
description: >-
  Patches README.md, .cursor/rules/project-stack.mdc, and AGENTS.md so their
  stated Go/React/TypeScript/Vite/Node versions match frontend/package.json,
  backend/go.mod, .nvmrc, and .github/workflows/ci.yml. Use when make
  check-stack-docs (or CI's stack-docs job) fails, after bumping React, Vite,
  TypeScript, Go, or CI Node/Go (including a Dependabot merge), or when the
  user mentions stack docs drift, version badges, or check_stack_docs.
---

# Doc sync patch (caught-looking)

`.github/scripts/check_stack_docs.py` (run via `make check-stack-docs`) only **detects** drift
between the manifests and the docs that quote their versions — it does not fix anything.
Dependabot bumps `frontend/package.json` / `backend/go.mod` / CI Node/Go without ever touching
the docs, so after almost every version-bump PR a human has had to hand-edit up to three files.
This skill does that patch.

## Order of work

### 1. Read the current failure (or just the source of truth)

```bash
make check-stack-docs
```

Each error line names the exact doc/value mismatch. If it's already green, read the source
files directly instead — you may have been asked to pre-emptively sync docs after a manual bump.

### 2. Read the source of truth

- `frontend/package.json` — `dependencies`/`devDependencies`: `react` (major), `typescript`
  (major.minor), `vite` (major).
- `backend/go.mod` — `go` directive (major.minor) and `toolchain` line if present.
- `.nvmrc` — Node major (preferred source; CI pins to it via `node-version-file`).
- `.github/workflows/ci.yml` — `go-version` (full), `node-version` (only read if no `.nvmrc`).

### 3. Patch every location the checker validates

| File | What to change |
|---|---|
| `README.md` | 4 shields.io badges near the top: `Go-{go_mm}-`, `React-{react_major}-`, `TypeScript-{ts_mm}-`, `Vite-{vite_major}-` |
| `README.md` | **Tech stack** table: `\| Frontend \| React {react_major}, TypeScript {ts_mm}, Vite, ...` and `\| Backend \| Go {go_mm}, ...` rows |
| `README.md` | **Prerequisites**: `- **Go** {go_mm}+ — builds the API` and `- **Node.js** {node_major}+ and **npm** — ... (CI uses Node {node_major}; ...)` |
| `.cursor/rules/project-stack.mdc` | **Stack** line: `Go {go_mm} API ..., React {react_major} + Vite + TypeScript {ts_major} (...)` |
| `AGENTS.md` | Opening **Stack** line, same pattern as `project-stack.mdc` |

Edit values only — do not reword surrounding prose, and do not touch the manifests themselves
(this skill syncs docs to already-bumped dependencies; it does not bump dependencies).

### 4. Verify

```bash
make check-stack-docs
```

Must print `Stack docs OK (...)`. If it still fails, re-read the error — it names the file and
the exact expected value.

## Anti-patterns

- Patching only README and skipping `project-stack.mdc` / `AGENTS.md` (or vice versa) — the
  checker validates all three independently.
- Guessing a version instead of reading it from `package.json` / `go.mod` / `.nvmrc` / `ci.yml`.
- Changing dependency versions in the manifests as part of this skill — that's a separate,
  deliberate upgrade decision, not a docs sync.
- Leaving `make check-stack-docs` red after editing.

## Reference

- Checker: `.github/scripts/check_stack_docs.py` (source of the exact regexes each doc must match).
- Rule: `.cursor/rules/readme.mdc` (README accuracy conventions, tech-stack section).
- Run via `make ci-local` / **`pr-ready`** skill before opening a PR.
