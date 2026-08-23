---
name: dependabot-triage
description: >-
  Reviews open Dependabot PRs (Go modules, npm — grouped minor/patch plus
  ungrouped majors, GitHub Actions), reads each one's embedded changelog and
  required CI status to classify risk, and merges only the PRs the user
  explicitly names. Use when asked to review or triage Dependabot PRs, do the
  weekly dependency review, or check the Dependabot backlog.
---

# Dependabot triage (caught-looking)

`.github/dependabot.yml` opens weekly PRs across three ecosystems (Go modules, npm — minor/patch
grouped, GitHub Actions — ungrouped, capped at 10 open each). The grouped npm-minor-and-patch PR
auto-merges on its own once required CI passes (`.github/workflows/dependabot-auto-merge.yml`) —
it may not even reach this triage, or only briefly. Everything else (Go modules, GitHub Actions,
and any ungrouped npm **major** bump) still has no auto-merge configured, so a human reads and
merges those by hand — README already asks for this ("Review Dependabot PRs like any other
change"). This skill does the reading and risk classification for that remaining traffic; merging
still requires the user to name which PRs.

## Order of work

### 1. List open Dependabot PRs

```bash
gh pr list --author "app/dependabot" --limit 100 --json number,title,labels,createdAt,statusCheckRollup
```

`gh pr list` defaults to 30 results — the three ecosystems' combined cap (10 each) already sits
at that boundary, and Dependabot **security updates** open outside the configured cap, so an
unset `--limit` can silently truncate the backlog with no warning. Always pass `--limit`.

If there are none open, say so and stop — nothing to triage.

### 2. Gather signal per PR

- **Ecosystem / bump shape** from the title and labels: `github_actions`, `javascript`
  (npm — often `Bump the npm-minor-and-patch group in /frontend with N updates`), or Go module
  path (`area: backend`, no distinct label — infer from `/backend` in the title).
- **Required CI only** — this repo's only merge-blocking checks are **`Frontend (...)`** and
  **`Backend (...)`** (they already run `npm audit --audit-level=high` and `govulncheck`
  respectively — see README's CI table). Everything else (`E2E`, `SBOM`, `CodeQL`, `Coverage
  comments`, preview jobs) is informational; ignore its state when judging mergeability.
- **Changelog** — `gh pr view <n> --json body`. Dependabot embeds the release notes in a
  collapsible `<details>` block. Scan for:
  - Security signals: `CVE`, `GHSA`, "security fix" — treat as **Security** regardless of size.
  - Breaking signals: `[BREAKING]`/`[CHANGE]` entries describing removed/renamed APIs, or a
    "minimum required <language/runtime> version" bump.
  - Otherwise routine (bugfixes, features, docs).

### 3. Classify each PR

Evaluate in this order — first match wins, so a PR never lands in two tiers:

1. **Security** — changelog/advisory references a CVE/GHSA or explicit security fix. Flag first,
   regardless of ecosystem or bump size; recommend merging promptly once required CI is green.
2. **Needs a look** — any of:
   - **GitHub Actions ecosystem**, any bump size. These are deliberately ungrouped in
     `dependabot.yml` so each is reviewed individually — they move a trusted pinned SHA/tag, which
     matters more than the version delta.
   - A **major** version bump (or a 0.x → 1.x jump) in Go or npm.
   - A breaking/minimum-version changelog entry (see step 2).
   - Required CI red.
3. **Low risk** — everything else: a Go **patch or minor** bump (ungrouped Go minors count too,
   including `golang.org/x/*` 0.x minors, which that ecosystem bumps routinely), required CI
   green, no breaking/minimum-version changelog entries.

GitHub Actions bumps never reach tier 3, no matter how small the version delta looks. The grouped
npm minor/patch PR auto-merges before it needs a tier — if it does show up here, required CI is
still running (transient, ignore) or failed (treat as **Needs a look**, since auto-merge won't
fire).

### 4. Report — do not merge yet

One table: PR #, package, bump, tier, one-line why (cite the changelog line that drove the
classification, not just "looks fine"). Stop here by default.

### 5. Merge only what the user names

```bash
gh pr merge <number> --squash
```

Matches this repo's existing convention (squash, single commit, title + `(#N)` — see `git log`).
Merge only PRs the user explicitly names in their reply (e.g. "merge #212 and #214"). Do not
batch-merge an entire tier on your own initiative, even "Low risk" — per `AGENTS.md`, never
merge a PR unless asked.

## Anti-patterns

- Merging anything the user didn't explicitly name this session.
- Treating a red **optional** check (E2E/SBOM/CodeQL) as blocking, or a green one as sufficient
  to skip reading the changelog.
- Classifying by semver label alone without reading the embedded release notes — they're already
  in the PR body; use them.
- Merging a GitHub Actions bump on CI-green alone — read the changelog first; that's exactly why
  `dependabot.yml` keeps Actions ungrouped and one-at-a-time.

## Reference

- Config: `.github/dependabot.yml`. README: **Dependabot** subsection under CI & quality gates.
- Required-checks source: README's CI table (`Frontend` / `Backend` jobs).
