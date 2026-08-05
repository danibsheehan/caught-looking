/**
 * Mirrors backend `gameStatusSettled` in handlers/cache_ttl.go.
 * Empty/unknown status is treated as unsettled (keep polling).
 */
export function gameStatusSettled(status: string | null | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  if (!s) return false;
  return (
    s.includes('final') ||
    s.includes('completed') ||
    s.includes('game over') ||
    s.includes('postponed') ||
    s.includes('cancelled') ||
    s.includes('canceled')
  );
}

/**
 * Badge copy for the score strip. Empty status must not read as Final — polling treats
 * blank/unknown as unsettled (same as {@link gameStatusSettled}).
 */
export function gameStatusLabel(status: string | null | undefined): string {
  const s = (status ?? '').trim();
  return s || 'Live';
}

/** Align with `CACHE_TTL_LIVE_SCORES` (45s) — polling sooner mostly hits the API cache. */
export const LIVE_GAME_POLL_INTERVAL_MS = 45_000;

/** Cap for exponential backoff after poll errors. */
export const LIVE_GAME_POLL_MAX_INTERVAL_MS = 5 * 60_000;
