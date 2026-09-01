---
name: bugbot-fix-verify
description: >-
  Verifies a Cursor Bugbot PR review comment's claim against the actual
  code, docs, or live behavior before fixing it -- then re-verifies the
  fix actually resolves it and hasn't introduced a new regression. Use
  when the user shares a Bugbot comment link/ID, says "bugbot comment" or
  "bugbot flagged," or asks to fix a Bugbot finding.
---

# Bugbot fix verify (caught-looking)

Bugbot findings are usually right, but "usually" isn't "always" — and even a correct finding's
suggested fix can be wrong, incomplete, or introduce a new problem. Every real Bugbot fix in this
repo's history followed the same pattern; the failures came from skipping a step, not from the
process being wrong.

## Order of work

### 1. Fetch the actual finding

```bash
gh api repos/<owner>/<repo>/pulls/<pr>/comments --jq '.[] | select(.id == <id>) | {path, line, body}'
```

Read the full body — severity, exact cited locations, and reasoning. Don't act on the title alone.

### 2. Verify the claim against ground truth, not the comment's own explanation

- **Code-level claim** (a logic gap, a tier matching nothing, a wrong file watched): read the
  actual file(s) at the cited locations yourself. Trace through the logic or run it — don't just
  agree it sounds plausible.
- **External-behavior claim** (a deprecated API, CSP/browser semantics, a library's execution
  order, a platform's default behavior): check the authoritative source — `go doc <pkg>`, the
  library's own docs, WebFetch to the vendor's documentation. A wrong hostname format assumption
  and a script-ordering fix in this repo both hinged on checking the vendor's actual docs, not
  the "obviously correct" fix.
- **If ground truth is itself ambiguous** (e.g. a permission requirement documented in two
  conflicting places): say so, and treat the actual PR as a live test with an easy rollback path
  rather than guessing confidently.

### 3. Fix precisely, not just plausibly

Apply the narrowest fix that resolves the confirmed issue, matching this codebase's existing
conventions (naming, error handling, comment style) — don't take the "Fix in Cursor" suggested
patch as-is without reading whether it actually fits.

### 4. Re-verify the fix actually resolves it

Run whatever check would have caught the original finding — the actual command
(`make lint-backend`, `go test`, a rebuilt `dist/` inspection), not just "looks right." A green CI
run alone isn't enough if the finding's own claim (e.g. "the comment still posts") is checkable
more directly by actually watching it happen.

### 5. Check the fix didn't open a new gap

Especially when the fix touches logic, precedence, or classification (tiers, conditionals,
priority order): re-run the *original* finding's own reasoning against the new state before
pushing. A prior fix in this repo closed one classification gap but accidentally made a different
case match two tiers at once — caught by a second Bugbot pass that could have been caught by
re-checking the first fix's own logic before pushing it.

## Anti-patterns

- Clicking "Fix in Cursor" / applying a suggested patch without reading and understanding it.
- Treating the comment's own explanation as verified fact — it's a claim, not ground truth.
- Fixing the literal symptom without checking whether the fix reintroduces the same class of bug
  elsewhere (see step 5).
- Declaring a job/check "fixed" without confirming it's actually green end-to-end — not just the
  one line the finding pointed at.
- Skipping verification because severity is Low/Medium — severity reflects blast radius, not
  confidence; low-severity findings are just as often correct as high-severity ones.

## Reference

- Fetch findings: `gh api repos/<owner>/<repo>/pulls/<pr>/comments`.
- Complements **`pr-ready`** — run this on any open Bugbot findings before considering a PR ready.
