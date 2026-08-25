---
name: weekly-project-update
description: >-
  Summarizes the past week's changes across Danielle's portfolio-linked repos
  (caught-looking, musing, baseball-collection, gotta-catch-em-all) in a warm, punchy,
  dual-audience voice and opens (never merges) one PR per repo with real signal
  against danibsheehan/danibsheehan.github.io, updating that repo's project section —
  a "Recent updates" blurb, and the "About this" prose when the week included
  something structurally notable. Use for the weekly portfolio-update routine, or
  when asked to summarize recent changes in any of these repos for the portfolio site.
---

# Weekly project update (portfolio-linked repos → portfolio)

`danibsheehan/danibsheehan.github.io` has a static project section per repo
(`projects/index.html`) that goes stale as each app evolves. This skill drafts a short summary
of what changed in each *source* repo over the past week and opens a PR per repo (only for repos
with real signal that week) in the portfolio repo to keep those sections current. It never
touches the source repos, and it never merges any PR it opens — see
[`docs/automation.md`](../../../docs/automation.md) for the autonomy boundary this skill
operates under.

## Repos covered

| Source repo | Portfolio section anchor | "About this" label id |
| --- | --- | --- |
| `danibsheehan/caught-looking` | `#project-caught-looking` | `caught-looking-build-label` |
| `danibsheehan/musing` | `#project-musing` | `musing-build-label` |
| `danibsheehan/baseball-collection` | `#project-baseball` | `baseball-build-label` |
| `danibsheehan/gotta-catch-em-all` | `#project-pokemon-battle-royale` | `pokemon-build-label` |

Run every step below **once per source repo**, independently — one repo's quiet week (skip) or
loud week (About-this rewrite) never affects another's.

## Order of work

### 1. Gather the week's changes (source repo, read-only)

```bash
gh pr list --repo <source-repo> --state merged --search "merged:>=<7-days-ago-date>" \
  --json number,title,body,mergedAt --limit 100
```

Falls back to `git log --since="7 days ago" --oneline` on that repo's default branch if `gh` PR
search comes up short (e.g. commits merged without a PR). Do not modify anything in the source
repo — this step is read-only. (A caller can widen the lookback window for a one-time backfill —
e.g. 14 days for a repo that's never had a "Recent updates" section — but the standing weekly
routine always uses 7 days.)

### 2. Filter for people-relevant signal

Skip pure dependency bumps (Dependabot version-bump titles with no accompanying story) and
doc-only drift fixes (README/rule wording, stack-doc sync) unless nothing else happened that
week — then a quieter week is fine to say plainly. Prioritize:

- **User-facing features** — new pages, new data on existing pages, UX changes.
- **Real bug fixes and performance/hardening work**, and any genuine "lesson learned" (a bug that
  revealed a wrong assumption, a fix that changed how something is cached or validated, etc).
- **AI agent usage and improvements** — a new or changed Claude Code / Cursor skill, a new
  autonomous or scheduled routine, a change to what an agent is trusted to do unattended (like
  this skill's own auto-merge or read-only boundaries). This project's portfolio story is partly
  about *how* it's built, so agent-workflow changes are people-relevant even when no app code
  moved — don't fold them into "CI/automation tooling" and skip them as a chore.

If there's nothing worth reporting under any of the above (a quiet week — only dependency bumps
and doc wording fixes, no new or changed skills/routines), stop here — do not open a PR for a
week with no people-relevant signal.

### 3. Draft the blurb

2-4 sentences. Voice:

- **Warm and friendly** — write like a person genuinely excited about the thing they built, not
  a changelog bot. Match the tone already used in `projects/index.html`'s existing Caught Looking
  prose, e.g. "It's a work in progress, but already a solid sandbox for anyone who wants to know
  why a team is winning, not just that they are."
- **Punchy** — short sentences land harder than a compound one padded with qualifiers. Cut hedges
  ("essentially," "basically," "in order to"). One well-placed short sentence can be a full beat
  on its own.
- **Human, not AI-slop** — no PR numbers, no commit hashes, no listicle throat-clearing ("In this
  update, we..."), no empty superlatives ("game-changing," "seamless," "robust"), no em-dash-heavy
  triplets. Say the specific true thing that happened, not a generic shape a sentence like this
  tends to take.
- **Dual-audience, not lowest-common-denominator** — this portfolio is read by non-technical
  visitors and by engineers sizing up the work. Don't strip out real technical detail; *translate*
  it so both readers get something. Name the actual mechanism when it's the interesting part (a
  caching layer, a race condition, a rate limit), then earn it with a plain-language reason a
  non-engineer still follows — e.g. "fixed a bug where two people loading the same game at once
  could get served stale data" beats both "fixed a caching bug" (too vague for an engineer) and
  "fixed a singleflight race in the TTL cache" (opaque to everyone else).

### 4. Decide if "About this" needs a rewrite

Only touch the existing `trip-story__prose` "About this" paragraphs when the week included
something structurally notable — a new major feature, a real architecture change (e.g. a new data
source, a new page). Routine fixes, perf tuning, and dependency work never trigger this; leave
those paragraphs alone in an ordinary week.

### 5. Edit the portfolio repo — one branch and PR per repo with signal

```bash
gh repo clone danibsheehan/danibsheehan.github.io /tmp/danibsheehan-site -- --depth 1
```

For each source repo that had people-relevant signal (step 2), branch off `master` fresh (a
separate branch per source repo, e.g. `weekly-update/<source-repo-slug>`) and edit
`projects/index.html`:

- Add or replace a "Recent updates" block inside that repo's project article (see the table
  above for its anchor). It holds **only the current week's blurb** — replace it in place each
  run, never append to a growing list. Reuse that article's existing `trip-story__*` BEM-style
  class naming (the `trip-story__grid-label` / `trip-story__prose` pair already used for "About
  this" in the same article) rather than inventing new markup or CSS; check `assets/css/` for the
  closest existing block before adding any new rule.
- If step 4 said yes for that repo, revise its `trip-story__prose` "About this" paragraphs in the
  same PR.

Each PR touches only its own repo's article — sections for different repos live in
non-overlapping parts of the same file, so independent PRs from independent branches merge
cleanly regardless of order.

### 6. Open the PR — never merge it

```bash
gh pr create --repo danibsheehan/danibsheehan.github.io --title "..." --body "..."
```

One PR per source repo with signal (skip repos with nothing to report — see step 2). Why-first PR
description: what changed in that source repo this week, in the same plain language as the blurb
itself. **Do not merge any of these PRs.** Merging is always a manual, separate decision — this
skill's job ends at opening them.

## Anti-patterns

- Editing anything in a source repo itself — this skill only reads those repos.
- Merging a portfolio PR, or leaving one in a state that looks pre-approved.
- Letting a "Recent updates" block accumulate more than the current week's entry.
- Rewriting "About this" for a routine week (dependency bumps, minor fixes) — save that rewrite
  for genuinely structural changes.
- Inventing or embellishing changes that didn't happen.
- Naming a mechanism (a cache, a rate limit, a race condition) without translating *why it
  mattered* in the same breath — technical detail earns its place by serving the story, not by
  demonstrating it exists.
- Writing like a changelog bot: listicle openers, empty superlatives, hedging qualifiers, generic
  AI-shaped sentences that could describe any project's commit history.
- Opening a PR for a repo whose week had nothing people-relevant to report.
- Blending signal from two source repos into one PR, or one repo's blurb leaking details from
  another repo's week.

## Reference

- Target sections: `projects/index.html` in `danibsheehan/danibsheehan.github.io` — see the
  "Repos covered" table above for each source repo's anchor and label id.
- Autonomy boundary: [`docs/automation.md`](../../../docs/automation.md) — "opens, never merges"
  is the guardrail for this specific routine, distinct from the read-only
  [`dependabot-triage`](../dependabot-triage/SKILL.md) routine.
