import {
  adjustChartColorForSurface,
  CHART_INK_MIN_CONTRAST,
} from './chartColorContrast'

/**
 * Series fills for charts that should **not** use MLB team primaries — cycles the
 * Neon on Obsidian chart fills: seeds align with `--accent` teal plus violet,
 * pink, and teal-tint companions for multi-series contrast. Keep hex seeds in
 * sync when `_base.scss` accent colors change.
 */
const THEME_SERIES_SEEDS = [
  '#00f5c4',
  '#c084fc',
  '#00c4a0',
  '#ff7aad',
  '#2dd4bf',
  '#f472b6',
] as const

/**
 * One fill per bar/series row, cycling through {@link THEME_SERIES_SEEDS} and
 * adjusting each for contrast vs the chart surface (usually `html` background).
 */
export function neonThemeSeriesFills(count: number, surfaceHex: string): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const seed = THEME_SERIES_SEEDS[i % THEME_SERIES_SEEDS.length]
    out.push(
      adjustChartColorForSurface(seed, surfaceHex, CHART_INK_MIN_CONTRAST),
    )
  }
  return out
}
