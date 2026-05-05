/**
 * Source `inning_topbot` is usually "Top" / "Bot" (not "Bottom").
 * Buckets for charts that split away (top) vs home (bottom).
 */
export type InningHalfBucket = 'top' | 'bottom' | 'other';

export function inningHalfBucket(inningHalf: string | undefined): InningHalfBucket {
  const s = (inningHalf ?? '').trim().toLowerCase();
  if (s === 'top') return 'top';
  if (s === 'bottom' || s === 'bot') return 'bottom';
  return 'other';
}
