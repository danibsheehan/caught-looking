/**
 * Shared Recharts axis tick props — Space Mono for axis values (Neon on Obsidian).
 * Use {@link polarAxisTickSans} for word labels (e.g. radar metrics).
 */
export const chartCartesianTick = {
  fill: 'var(--chart-tick)',
  fontSize: 11,
  fontFamily: 'var(--mono)',
} as const;

/** Polar / categorical labels stay sans. */
export const polarAxisTickSans = {
  fill: 'var(--text)',
  fontSize: 11,
  fontFamily: 'var(--sans)',
} as const;
