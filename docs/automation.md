# AI-assisted development & automation

Caught Looking is built and maintained with Cursor and Claude Code doing a lot of the day-to-day
work — from scaffolding a new endpoint to triaging dependency bumps. This page is about the
parts worth calling out specifically: what's allowed to act **on its own**, versus what an AI
assistant only ever does **at a person's request**.

**In plain English:** one narrow, low-risk decision (merging a routine grouped dependency bump
once tests pass) runs unattended. Everything else — reading code, writing PRs, triaging the
riskier dependency updates, keeping docs in sync — is an AI assistant doing work a person asked
for, in that session, with that person reviewing the result.

Back to the [docs home](README.md) · [root README](../README.md).

## What runs on its own

| Automation | What it does | Guardrail |
| :--- | :--- | :--- |
| npm minor/patch auto-merge | [`dependabot-auto-merge.yml`](../.github/workflows/dependabot-auto-merge.yml) merges the grouped `npm-minor-and-patch` Dependabot PR the moment the required **Frontend** / **Backend** / **Lint** checks pass. Plain GitHub Actions + [`dependabot/fetch-metadata`](https://github.com/dependabot/fetch-metadata) — no LLM involved. | Scoped to that one grouped, lowest-risk PR only. Go modules, GitHub Actions bumps, and any ungrouped npm **major** version bump are excluded on purpose and still need a human. |
| Weekly Dependabot triage | A scheduled Claude Code **routine** (a cloud agent on a cron schedule) clones the repo every Monday, follows [`dependabot-triage`](../.cursor/skills/dependabot-triage/SKILL.md) step by step — lists the remaining open Dependabot PRs, reads each changelog and required-CI result, classifies Security / Needs a look / Low risk — and sends a summary notification. | Read-only by instruction: it never merges, comments on, or closes a PR. It produces a report; a person still decides what to merge. |

## What a person (or their AI assistant) triggers on demand

Most of the AI-assisted work here isn't autonomous at all — it's Cursor or Claude Code doing a
task because someone asked, in an interactive session, with the person reviewing the diff before
anything ships. That work is guided by:

- **[`AGENTS.md`](../AGENTS.md)** — the tool-agnostic reference (install/run/test, conventions,
  what not to do) that both Cursor and Claude Code read.
- **[`.cursor/rules/*.mdc`](../.cursor/rules/)** — path-scoped conventions (backend Go, React,
  OpenAPI contract discipline, README accuracy, and more) applied automatically when matching
  files are touched.
- **[`.cursor/skills/`](../.cursor/skills/)** — step-by-step playbooks for specific jobs:
  scaffolding a new API endpoint end-to-end, writing backend/frontend tests, verifying a Bugbot
  finding before fixing it, catching stack-version doc drift after a dependency bump, and more.
  See `AGENTS.md`'s **Step-by-step playbooks** list for the full set. `.claude/skills` is a
  symlink to the same directory, so Claude Code sees exactly what Cursor sees.

## Why the split

[`AGENTS.md`](../AGENTS.md) has a hard rule: an AI assistant does not open, push, or merge a pull
request unless a person asks it to, in that session. Full autonomy was carved out for exactly one
case — a grouped, semver-minor-or-patch dependency bump with green required CI — because it's the
one merge decision mechanical enough not to need a human read. Everything riskier (a major
version, a GitHub Actions pin change, anything with a breaking-change note in its changelog)
stays behind the same rule as any other change: a person names it before it merges.
