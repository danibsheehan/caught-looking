---
name: pr-summary-draft
description: >-
  Drafts a why-first PR Summary and How-to-verify section by reading the
  actual diff and commits on the current branch, not just which paths
  changed. Use when opening a PR, updating a PR description, asked to draft
  a PR summary, or when the user asks what changed and why on this branch.
---

# PR summary draft (caught-looking)

`.github/scripts/pr_guide_lib.py` (via the `PR guide` GitHub Action) already scaffolds the
mechanical parts of a PR — path-based **Touches**, suggested verify commands, and a checklist —
posted as a sticky **PR guide** comment and an empty `## Summary` prompt in the PR body. It
classifies by file path only; it cannot know *why* a change was made. This skill fills that gap:
read the real diff, then write the Summary a human would write.

Do not re-derive or duplicate the path-based checklist/verify-command list — that's already
automated and posted separately. This skill only writes prose: **Summary** and, where it adds
real user-facing value beyond the automated commands, **How to verify**.

## Order of work

### 1. Read the actual change, not just file names

```bash
git diff main...HEAD          # or the PR's base branch if not main
git log --oneline main...HEAD
```

Read the diff content for the changed files — hunks, not just a file list. If the branch is long
or touches many files, prioritize the files that changed *behavior* (handlers, components,
config, tests asserting new behavior) over mechanical ones (generated types, formatting-only
diffs).

### 2. Identify the why

Look for the motivation in, roughly this priority order:
1. What the conversation/task that produced this branch was actually trying to fix or add.
2. Commit messages, if they explain intent (not just "wip" / "fix").
3. What the diff implies: a bug fix (what broke, for whom), a new capability (what it unlocks),
   a refactor (what got harder to maintain and why this fixes it).

If the diff's purpose is genuinely ambiguous — e.g. a mixed-bag branch, or a change whose intent
isn't evident from code or conversation — ask the user rather than inventing a plausible-sounding
motivation. A wrong guess is worse than a question.

### 3. Write the Summary

Follow `.github/pull_request_template.md` and the **pr-ready** skill's guidance exactly:

- Lead with **why** (motivation / problem), then what changed for users, API, or data.
- 1–3 short bullets. Do not stop at a file list or restate commit subjects.
- Weak: `Update chart-frame CSS and TeamWinsBarChart className.`
- Stronger: `Charts nested under panels needed long descendant selectors for width/margin; make
  chart-frame own that spacing so wins/scatter/leaders shells stay consistent.`

### 4. Write How to verify (when it adds value)

User-facing steps: routes/pages to visit, expected before/after behavior. Use `N/A` for
tooling-only changes. Don't restate the automated verify-command checklist (`make test-frontend`,
`make check-openapi`, etc.) — the sticky PR guide comment already has that; this section is for
what a human reviewer would actually *do* to see the change work.

### 5. Apply it

- **New PR**: `gh pr create --title "..." --body "$(cat <<'EOF' ... EOF)"` with the Summary and
  How to verify sections filled in. Only create the PR if the user asked for one.
- **Existing PR**: `gh pr edit <number> --body-file <file>` — read the current body first
  (`gh pr view <number> --json body`) and preserve anything below the `<!-- pr-guide:meta -->`
  marker if present (the PR guide workflow manages that block; don't hand-edit or remove it).

## Anti-patterns

- Summaries that restate the diff (`Changed X.tsx, Y.go`) instead of explaining motivation.
- Guessing "why" when it isn't evident from the diff, commits, or conversation — ask instead.
- Duplicating `generate_pr_guide.py`'s path-based checklist/verify output by hand.
- Removing or hand-editing the `<!-- pr-guide:meta -->` block in an existing PR body.
- Opening, editing, or pushing a PR without being asked.

## Reference

- Template: `.github/pull_request_template.md`.
- Mechanical scaffolding (untouched by this skill): `.github/scripts/pr_guide_lib.py`,
  `generate_pr_body.py`, `generate_pr_guide.py`, `.github/workflows/pr-guide.yml`.
- Full pre-PR flow: **`pr-ready`** skill.
