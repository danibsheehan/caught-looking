---
name: weekly-project-update
description: >-
  Summarizes the past week's changes to caught-looking in plain, people-friendly
  language and opens (never merges) a PR against danibsheehan/danibsheehan.github.io
  updating the "Caught Looking" project section — a "Recent updates" blurb, and the
  "About this" prose when the week included something structurally notable. Use for
  the weekly portfolio-update routine, or when asked to summarize recent caught-looking
  changes for the portfolio site.
---

# Weekly project update (caught-looking → portfolio)

`danibsheehan/danibsheehan.github.io` has a static "Caught Looking" project section
(`projects/index.html`, inside `#project-caught-looking`) that goes stale as this app evolves.
This skill drafts a short, non-technical summary of what changed in `caught-looking` over the
past week and opens a PR in the portfolio repo to keep that section current. It never touches
`caught-looking` itself, and it never merges the PR it opens — see [`docs/automation.md`](../../../docs/automation.md)
for the autonomy boundary this skill operates under.

## Order of work

### 1. Gather the week's changes (caught-looking, read-only)

```bash
gh pr list --repo danibsheehan/caught-looking --state merged --search "merged:>=<7-days-ago-date>" \
  --json number,title,body,mergedAt --limit 100
```

Falls back to `git log --since="7 days ago" --oneline` on `main` if `gh` PR search comes up
short (e.g. commits merged without a PR). Do not modify anything in `caught-looking` — this step
is read-only.

### 2. Filter for people-relevant signal

Skip pure dependency bumps (Dependabot titles), CI/lint-only churn, and doc-only drift fixes
unless nothing else happened that week — then a quieter week is fine to say plainly. Prioritize:
user-facing features, real bug fixes, performance/hardening work, and any genuine "lesson
learned" (a bug that revealed a wrong assumption, a fix that changed how something is cached or
validated, etc).

If there's nothing worth reporting (a quiet week, only chores), stop here — do not open a PR for
a week with no people-relevant signal.

### 3. Draft the blurb

2-4 sentences, plain language, no PR numbers, no commit hashes, no internal jargon (no "TTL",
"QPS", "OpenAPI drift" — describe the outcome, not the mechanism). Match the tone already used in
`projects/index.html`'s existing Caught Looking prose, e.g. "It's a work in progress, but already
a solid sandbox for anyone who wants to know why a team is winning, not just that they are."

### 4. Decide if "About this" needs a rewrite

Only touch the existing `trip-story__prose` "About this" paragraphs when the week included
something structurally notable — a new major feature, a real architecture change (e.g. a new data
source, a new page). Routine fixes, perf tuning, and dependency work never trigger this; leave
those paragraphs alone in an ordinary week.

### 5. Edit the portfolio repo

```bash
gh repo clone danibsheehan/danibsheehan.github.io /tmp/danibsheehan-site -- --depth 1
```

Branch off `master`. Edit `projects/index.html`:

- Add or replace a "Recent updates" block inside the `#project-caught-looking` article. It holds
  **only the current week's blurb** — replace it in place each run, never append to a growing
  list. Reuse the article's existing `trip-story__*` BEM-style class naming (e.g. the
  `trip-story__grid-label` / `trip-story__prose` pair already used for "About this") rather than
  inventing new markup or CSS; check `assets/css/` for the closest existing block before adding
  any new rule.
- If step 4 said yes, revise the `trip-story__prose` "About this" paragraphs in the same PR.

### 6. Open the PR — never merge it

```bash
gh pr create --repo danibsheehan/danibsheehan.github.io --title "..." --body "..."
```

Why-first PR description: what changed in caught-looking this week, in the same plain language as
the blurb itself. **Do not merge this PR.** Merging is always a manual, separate decision — this
skill's job ends at opening it.

## Anti-patterns

- Editing anything in `caught-looking` itself — this skill only reads that repo.
- Merging the portfolio PR, or leaving it in a state that looks pre-approved.
- Letting "Recent updates" accumulate more than the current week's entry.
- Rewriting "About this" for a routine week (dependency bumps, minor fixes) — save that rewrite
  for genuinely structural changes.
- Inventing or embellishing changes that didn't happen, or leaking internal implementation detail
  (cache TTLs, rate limits, endpoint names) into a portfolio-facing blurb.
- Opening a PR for a week with nothing people-relevant to report.

## Reference

- Target section: `projects/index.html`, `#project-caught-looking` article, in
  `danibsheehan/danibsheehan.github.io`.
- Autonomy boundary: [`docs/automation.md`](../../../docs/automation.md) — "opens, never merges"
  is the guardrail for this specific routine, distinct from the read-only
  [`dependabot-triage`](../dependabot-triage/SKILL.md) routine.
