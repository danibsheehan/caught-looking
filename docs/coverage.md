# Coverage gates

How much of the code our tests have to exercise before CI lets a change through. Unfamiliar with terms like line rate or Cobertura? See the [glossary](README.md#a-few-terms-in-plain-words).

**In plain English:** CI fails if too little of the code is run by the tests. The backend and the frontend have different bars, and the frontend has a couple of extra checks layered on top.

Back to the [docs home](README.md) · [root README](../README.md).

## The gates

| Where | Gate | Measured how | Source of truth |
| --- | --- | --- | --- |
| Backend (CI and `make ci-local-backend`) | ≥70% line rate | Cobertura root `line-rate` | `COVERAGE_MIN` in [`Makefile`](../Makefile); `coverage-threshold` in [`verify.yml`](../.github/workflows/verify.yml) |
| Frontend, Vitest (the real gate) | statements 83, branches 73, functions 80, lines 85 | Vitest V8 coverage, enforced by `npm run test:coverage` | `coverage.thresholds` in [`frontend/vite.config.ts`](../frontend/vite.config.ts) |
| Frontend, CI coverage comment | ≥78 | cobertura-action's blended per-file figure, (line rate + branch rate) / 2; a stand-in for the Vitest gate | `coverage-minimum` in [`verify.yml`](../.github/workflows/verify.yml) |
| Frontend, `make ci-local-frontend` extra check | ≥70% line rate | Cobertura root `line-rate` | `COVERAGE_MIN` in [`Makefile`](../Makefile) |

## When it fails

If coverage fails or sits close to a gate, the **`foundations:coverage-gap-diagnosis`** skill reads the local coverage output for the files changed on your branch and names the specific untested branches and error paths, instead of just the percentage.

## Changing a number

Edit the source of truth named in the table, then update this page so the two stay in step.
