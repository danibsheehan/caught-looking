---
name: venue-data-sync
description: >-
  Checks frontend/src/data/mlbVenueFieldDimensions.ts's hand-maintained
  venue-id -> field-dimensions table against the live MLB Stats API and
  drafts entries for new/changed venues from a published source. Use when a
  team relocates, a new ballpark opens, or the user asks to check or update
  MLB venue field dimensions.
---

# Venue data sync (caught-looking)

`frontend/src/data/mlbVenueFieldDimensions.ts`'s `VENUE_FIELD_DIMENSIONS_FT` is a hand-typed
`Record<venueId, {lf, cf, rf}>` — the only per-venue table in the app (`parkSprayOutline.ts`
derives its outline generically from `FieldDimensionsFt`; it has **no** per-venue data of its
own, so it never needs a new entry). A missing venue silently falls back to
`DEFAULT_FIELD_DIMS` (a league-average template) via `getFieldDimensionsForVenue` — no crash, no
error, just a slightly-wrong spray-chart shape nobody notices until they look closely. This gap
is real but rare (a franchise relocation or new ballpark, roughly once a decade), so it's a
reactive/on-demand check, not something to run on a schedule.

## Order of work

### 1. Fetch the live venue list

```bash
curl -s 'https://statsapi.mlb.com/api/v1/teams?sportId=1&activeStatus=Y'
```

Same public API base the backend already uses by default (`MLB_BASE_URL` in
`backend/config/config.go`). Extract each team's `venue.id`, `venue.name`, and `name`.

### 2. Diff against the table

Compare live venue IDs against the keys in `VENUE_FIELD_DIMENSIONS_FT`:

- **Live ID missing from the table** → a franchise is at a venue the table doesn't know about
  (new ballpark, or a relocation that got a new venue ID — as happened when the Athletics moved
  to Sutter Health Park, venue `2529`, already reflected in the table).
- **Table ID missing from live data** → possibly stale (team no longer plays there). Confirm the
  venue is genuinely gone before removing — don't delete on a single check.
- **Same ID, different `venue.name`** → sponsorship/naming-rights rename only (e.g. venue `22`
  is now "UNIQLO Field at Dodger Stadium" in the live API, same physical building). **Not** a
  trigger — the numbers don't need to change, only the inline comment, and only if you want to.

### 3. Source real dimensions for any genuinely new/changed venue

Look up the ballpark's published outfield line distances (LF/CF/RF, feet) from a reliable public
source — the team's official ballpark page or the ballpark's Wikipedia infobox are the usual
sources already used for the existing entries. Draft the entry in the file's exact style:

```ts
venueId: { lf: X, cf: Y, rf: Z }, // Ballpark Name
```

Cite the source you used when reporting this (in the PR description, not the file — matching the
existing terse `// Name` comment style).

### 4. Report — don't guess, don't auto-edit without review

These are physical facts, not derivable logic — an unsourced or estimated number is worse than
the graceful `DEFAULT_FIELD_DIMS` fallback already in place. Draft the entry and cite the source;
let the user confirm before it's committed.

## Anti-patterns

- Flagging a naming-rights-only rename (ID unchanged) as needing a dimensions update.
- Editing `parkSprayOutline.ts` for a new venue — it has no per-venue data to update.
- Guessing or estimating a dimension instead of citing a real published source.
- Removing a venue ID from the table on a single live-check absence without confirming the team
  actually relocated or the venue closed.

## Reference

- `frontend/src/data/mlbVenueFieldDimensions.ts` — the table, `getFieldDimensionsForVenue`
  fallback behavior, and existing comment style.
- `frontend/src/data/parkSprayOutline.ts` — generic geometry derived from `FieldDimensionsFt`;
  confirms this table is the only per-venue source of truth.
- `backend/config/config.go` — `MLB_BASE_URL` default, same API base this skill queries directly.
