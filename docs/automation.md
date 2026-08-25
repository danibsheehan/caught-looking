# AI-assisted development & automation

Caught Looking is built and maintained with Cursor and Claude Code doing a lot of the day-to-day
work — from scaffolding a new endpoint to triaging dependency bumps. This page is about the
parts worth calling out specifically: what's allowed to act **on its own**, versus what an AI
assistant only ever does **at a person's request**.

**In plain English:** one narrow, low-risk decision (merging a routine grouped dependency bump
once tests pass) runs unattended. A couple of scheduled workflows are allowed to open — but
never merge — a PR on their own, because opening a PR isn't the risky step; merging one (which
ships to production here, or updates a portfolio page there) is. Everything riskier — triaging
dependency updates, keeping docs in sync, anything that actually merges or deploys — is a person
deciding, with an AI assistant doing work they asked for in that session.

Back to the [docs home](README.md) · [root README](../README.md).

## What runs on its own

| Automation | What it does | Guardrail |
| :--- | :--- | :--- |
| npm minor/patch auto-merge | [`dependabot-auto-merge.yml`](../.github/workflows/dependabot-auto-merge.yml) merges the grouped `npm-minor-and-patch` Dependabot PR the moment the required **Frontend** / **Backend** / **Lint** checks pass. Plain GitHub Actions + [`dependabot/fetch-metadata`](https://github.com/dependabot/fetch-metadata) — no LLM involved. | Scoped to that one grouped, lowest-risk PR only. Go modules, GitHub Actions bumps, and any ungrouped npm **major** version bump are excluded on purpose and still need a human. |
| Weekly Dependabot triage | A scheduled Claude Code **routine** (a cloud agent on a cron schedule) clones the repo every Monday, follows [`dependabot-triage`](../.cursor/skills/dependabot-triage/SKILL.md) step by step — lists the remaining open Dependabot PRs, reads each changelog and required-CI result, classifies Security / Needs a look / Low risk — and sends a summary notification. | Read-only by instruction: it never merges, comments on, or closes a PR. It produces a report; a person still decides what to merge. |
| Weekly portfolio update | A scheduled Claude Code **routine** clones `caught-looking` and three of Danielle's other portfolio-linked repos (`musing`, `baseball-collection`, `gotta-catch-em-all`) every Monday and follows [`weekly-project-update`](../.cursor/skills/weekly-project-update/SKILL.md) — summarizes each repo's people-relevant changes in plain language, then opens one PR per repo with real signal in a *different* repo, `danibsheehan/danibsheehan.github.io`, updating that repo's project section. | Opens PRs, but never merges them. Scoped to that one portfolio repo, one project section per source repo, and only repos with something people-relevant to report that week; a person still reviews and merges each PR by hand. |
| Weekly perf metrics snapshot | [`perf-metrics.yml`](../.github/workflows/perf-metrics.yml) runs `make load-smoke` every Monday (and on demand via `workflow_dispatch`) against the fixture upstream, then regenerates [`docs/perf-results.md`](perf-results.md) with the latest cold/warm latency sweep and opens a PR if the numbers changed. Plain GitHub Actions — no LLM involved. | Opens a PR, but never merges it. Only ever touches `docs/perf-results.md`; no live MLB/Savant traffic. |

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

[`AGENTS.md`](../AGENTS.md) has a hard rule: an AI assistant does not **merge** a pull request
unless a person asks it to, in that session, because merging is the step that ships to production
(or, for the portfolio routine, to a live site). Full autonomy to merge was carved out for exactly
one case — a grouped, semver-minor-or-patch dependency bump with green required CI — because it's
the one merge decision mechanical enough not to need a human read. Everything riskier (a major
version, a GitHub Actions pin change, anything with a breaking-change note in its changelog) stays
behind the same rule as any other change: a person names it before it merges.

Autonomous PR **creation** is a different, much lower-risk action — it doesn't ship anything, and
a person still reviews the diff before the merge button matters. Both scheduled workflows above
open PRs on their own for exactly that reason: the portfolio-update routine because that repo is
outside `caught-looking`'s own change surface, and the perf-metrics workflow because it only ever
touches one generated, mechanically-produced doc file. Neither one merges.
