---
name: frontend-vitest-tests
description: >-
  Writes or updates Vitest + Testing Library tests for caught-looking’s frontend:
  mocked api/client, renderHook, jsdom, and coverage. Use when adding or changing
  code under frontend/src, writing *.test.ts(x), fixing flaky UI/hook tests, or when
  the user mentions frontend tests, Vitest, RTL, or test coverage.
---

# Frontend Vitest tests (caught-looking)

## When this applies

- Editing `frontend/src/**/*.test.ts`, `frontend/src/**/*.test.tsx`, or `frontend/src/test/setup.ts`.
- Adding tests for **`api/client`**, **`hooks/`**, **`utils/`**, or **`components/`**.
- Adjusting **`vite.config.ts`** `test` / `coverage` options.

## Stack (must match repo)

- **Runner**: Vitest (`vitest/config` merged in `frontend/vite.config.ts`).
- **DOM**: **jsdom** (`test.environment: 'jsdom'`).
- **Assertions / matchers**: **`@testing-library/jest-dom/vitest`** via `frontend/src/test/setup.ts`.
- **Components**: **`@testing-library/react`** (`render`, `screen`, `within`, `waitFor`, `renderHook`).
- **Interactions**: **`@testing-library/user-event`** (prefer over firing raw DOM events).

## Conventions (must follow)

1. **File placement**
   - Colocate tests: `Component.test.tsx` next to `Component.tsx`, or `*.test.ts` next to modules (e.g. `client.test.ts` under `api/`).
   - Shared setup only in **`frontend/src/test/setup.ts`** (e.g. `cleanup()`, jest-dom).

2. **API and `fetch`**
   - **`vi.mock('../../api/client')`** (or correct relative path from the test file) and **`vi.mocked(fetchX)`** for `fetch…` helpers.
   - Do **not** call the real backend in unit tests; assert **URLs / params** via mock call args (see existing `client.test.ts`).

3. **Hooks (`renderHook`)**
   - Mock client functions; resolve with minimal typed payloads from **`frontend/src/types/api.d.ts`**.
   - Effects that use **`setTimeout(0)`** or debounces: **`waitFor` on `result.current.data` / `error` / mock calls**, not only `loading === false`, because some hooks start with `loading: false` and race.

4. **UI components**
   - Prefer **roles and accessible names** (`getByRole('button', { name: /…/ })`, `getByRole('combobox', { name: '…' })`).
   - Controlled props: if the parent must update after `onChange`, use a small **stateful harness** in the test (see `PlayerPicker.test.tsx`).
   - Debounced search (e.g. **320ms**): use **real timers** + **`setTimeout` flush** or `waitFor`; **`userEvent` + fake timers** often deadlocks—avoid unless you wire `advanceTimers` correctly.

5. **DOM cleanup**
   - Global **`cleanup()`** runs in **`setup.ts`** `afterEach`. If you ever disable it, unmount between tests to avoid **multiple comboboxes / duplicate roles**.

6. **Error boundaries / `console`**
   - Stub **`console.error`** when testing `componentDidCatch` if you need a quiet log; **restore** after the suite.

7. **Commands**
   - **`cd frontend && npm run test:run`** (CI parity) or **`npm run test`** (watch).
   - Coverage: **`npm run test:coverage`** — HTML report under **`frontend/coverage/`** (gitignored).
   - From repo root: **`make test-frontend`**.
   - Before finishing: **`npm run lint`**, **`npm run typecheck`**, **`npm run test:run`** (matches CI).

## Anti-patterns

- Importing production modules before `vi.mock` factories in a way that prevents mocking (keep mocks at top level; use **`vi.resetModules()` + dynamic `import()`** when testing `import.meta.env` / `API_BASE`, as in `client.test.ts`).
- Asserting **pixel** layout or Recharts internals instead of **data / labels / roles**.
- **One shared `Response`** from `fetch` for two `json()` reads (body consumed twice).

## Reference locations

- Vitest config: `frontend/vite.config.ts` (`test`, `coverage.exclude`).
- Setup: `frontend/src/test/setup.ts`.
- Examples: `frontend/src/api/client.test.ts`, `frontend/src/hooks/*.test.ts`, `frontend/src/components/**/*.test.tsx`, `frontend/src/utils/*.test.ts`.
