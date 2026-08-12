# CLAUDE.md

@AGENTS.md

The above is the canonical, tool-agnostic reference (install/configure/run/test, conventions,
constraints, definition of done) — also read by Cursor and any other agent. Everything below is
Claude Code–specific session mechanics.

## Always-apply rule

@.cursor/rules/project-stack.mdc

## Scoped rules — read the file when touching its paths

| Rule | Applies to |
|---|---|
| `.cursor/rules/backend-go.mdc` | `backend/**/*.go` |
| `.cursor/rules/frontend-react.mdc` | `frontend/**/*.tsx`, `frontend/src/hooks/**/*.ts` |
| `.cursor/rules/frontend-api.mdc` | `frontend/src/api/**/*.ts` |
| `.cursor/rules/frontend-api-types.mdc` | `frontend/src/types/api.generated.ts`, `frontend/src/types/api.compat.ts` |
| `.cursor/rules/frontend-bem.mdc` | new `frontend/**/*.tsx`, `frontend/src/**/*.scss` classnames |
| `.cursor/rules/frontend-prettier.mdc` | `frontend/**/*.{ts,tsx,js,scss,json,html}` |
| `.cursor/rules/frontend-testing.mdc` | `frontend/**/*.{test,spec}.{ts,tsx}`, `frontend/src/test/**/*` |
| `.cursor/rules/openapi-contract.mdc` | `backend/apidocs/openapi.yaml`, `backend/handlers/**/*.go`, `backend/models/**/*.go`, `frontend/src/types/api.compat.ts`, `frontend/src/api/**/*.ts` |
| `.cursor/rules/readme.mdc` | `README.md`, design tokens (`frontend/src/styles/_base.scss`), stack manifests, `docs/**` |

## Skills

`.claude/skills` is a directory symlink to `.cursor/skills` — same files, no copies. Claude Code
auto-discovers and invokes them by task the same way Cursor does.
