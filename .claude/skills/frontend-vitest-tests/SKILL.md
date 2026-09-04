---
name: frontend-vitest-tests
description: >-
  Writes or updates Vitest + Testing Library tests for caught-looking's frontend:
  mocked api/client, api.compat fixtures, and useAsyncResource hooks. Use when
  adding or changing code under frontend/src, writing *.test.ts(x), fixing flaky
  UI/hook tests, or when the user mentions frontend tests, Vitest, RTL, or test
  coverage.
---

# Frontend Vitest tests (caught-looking)

For the React+Vitest+Testing Library mechanics this follows (mock the API client, the
`renderHook` loading-race gotcha, roles/loading/error/empty checklist, mock-hoisting and
double-`Response`-read anti-patterns), see the **`foundations:react-vitest-testing`** skill.
This file is caught-looking's own mocking/fixture reference.

## When this applies

- Editing `frontend/src/**/*.test.ts`, `frontend/src/**/*.test.tsx`, or `frontend/src/test/setup.ts`.
- Adding tests for **`api/client`**, **`hooks/`**, **`utils/`**, or **`components/`**.
- Adjusting **`vite.config.ts`** `test` / `coverage` options.

## Conventions

1. **API and `fetch`** — **`vi.mock('../../api/client')`** (or correct relative path from the test file) and **`vi.mocked(fetchX)`** for `fetch…` helpers. Do **not** call the real backend in unit tests; assert **URLs / params** via mock call args (see existing `client.test.ts`). Typed fixtures: prefer minimal payloads shaped like **`frontend/src/types/api.compat`** (OpenAPI-derived). If the contract is new, regenerate types first — see **`.claude/skills/openapi-maintain/SKILL.md`**.

2. **Hooks (`renderHook`)** — mock client functions; resolve with minimal typed payloads from **`api.compat`**. Prefer patterns from **`useAsyncResource`** (`AbortController` cleanup, `startTransition` for loading/error resets).

3. **Debounced search** (e.g. **320ms** in `PlayerPicker`): use **real timers** + **`setTimeout` flush** or `waitFor`.

4. **Commands**
   - **Task done**: **`cd frontend && npm run test:run`** (or **`npm run test`** in watch) for the suites you touched; run **`npx prettier --write`** on changed files if the Prettier hook did not cover them (see `AGENTS.md`'s **Prettier formatting** conventions).
   - Coverage when investigating the gate: **`npm run test:coverage`** — HTML under **`frontend/coverage/`** (gitignored). From repo root: **`make test-frontend`**.
   - **PR done**: **`make ci-local`** / **`.claude/skills/local-ci-parity/SKILL.md`** — do not run full lint/typecheck/build/CI on every test edit.

## Anti-patterns

- Asserting **pixel** layout or Recharts internals instead of **data / labels / roles**.

## Reference locations

- Vitest config: `frontend/vite.config.ts` (`test`, `coverage.exclude`).
- Setup: `frontend/src/test/setup.ts`.
- Examples: `frontend/src/api/client.test.ts`, `frontend/src/hooks/*.test.ts`, `frontend/src/components/**/*.test.tsx`, `frontend/src/utils/*.test.ts`.
