---
name: coverage-gap-diagnosis
description: >-
  Reads local coverage output for the files changed on this branch and names
  the specific untested branches/error paths, instead of a bare percentage.
  Use when coverage is close to the ≥50% gate, dropped, or the user asks
  what's undertested, to diagnose a coverage gap, or why coverage failed.
---

# Coverage gap diagnosis (caught-looking)

`post_coverage_comment.py` (the sticky PR coverage comment) only reads the Cobertura
`<coverage line-rate="...">` root attributes — an aggregate percentage, pass/fail against the
50% gate. It never looks at which lines, in which changed files, are actually untested. This
skill does that, locally, before or instead of waiting on the CI comment.

## Order of work

### 1. Find the changed source files

```bash
git diff --name-only main...HEAD -- 'backend/**/*.go' 'frontend/src/**/*.ts' 'frontend/src/**/*.tsx' \
  | grep -v -e '_test\.go$' -e '\.test\.'
```

Exclude test files themselves and generated files (`frontend/src/types/api.generated.ts`) — you
want the files being tested, not the tests.

### 2. Generate coverage

```bash
make cover-backend    # writes backend/coverage.out, prints per-func % (go tool cover -func)
make cover-frontend   # runs vitest --coverage, prints a per-file table to the terminal
```

### 3. Find uncovered lines in the changed files

**Backend** — `coverage.out` lines are `file:startLine.col,endLine.col numStmts count`; a
trailing `0` means uncovered:

```bash
grep "backend/path/to/file.go:" backend/coverage.out | grep -E ' 0$'
```

**Frontend** — the `test:coverage` terminal table has an **`Uncovered Line #s`** column per file
(comma-separated line numbers/ranges). Read the row for each changed file.

### 4. Describe what's untested, not just where

Read the actual source at each uncovered range. Say what *behavior* is missing a test — an error
branch, a specific prop/state combination, an empty-state render — not just "lines 58–83
uncovered." Cross-reference the coverage conventions already documented:

- **Backend** (`backend-go-tests`): validation / success / upstream-failure table cases are the
  stated minimum per handler. If the uncovered range is the upstream-failure branch specifically,
  say so — it's a gap against a bar the repo already documents, not just a number.
- **Frontend** (`frontend-vitest-tests`): loading / error / empty states are the stated minimum
  per component. Same treatment.

### 5. Report

One list: file:lines → what's untested → (optionally) the specific missing test case named in
`backend-go-tests`/`frontend-vitest-tests` terms. This skill diagnoses; it doesn't write the
tests unless asked — offer to, don't assume.

## Anti-patterns

- Reporting bare percentages or raw line numbers with no description of the missing behavior —
  that's what the CI coverage comment already gives you; this skill exists to go further.
- Flagging gaps in files the branch didn't touch (noise) — scope to the diff.
- Flagging genuinely unreachable lines (e.g. a `default: panic("unreachable")` arm) as meaningful
  gaps.
- Writing test code without being asked.

## Reference

- `.github/scripts/post_coverage_comment.py` — the aggregate-percentage comment this complements.
- `backend-go-tests` / `frontend-vitest-tests` — the coverage conventions this diagnoses against.
- `make cover-backend` / `make cover-frontend`; full gate via `make ci-local`.
