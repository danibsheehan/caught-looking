import {
  adjustChartColorForSurface,
  CHART_INK_MIN_CONTRAST,
} from './chartColorContrast'

/**
 * Series fills for charts that should **not** use MLB team primaries — cycles the
 * Neon on Obsidian accent pair (`_base.scss`: `--accent`, `--accent-2`, etc.) and
 * close teal/rose derivatives. Keep in sync when those CSS tokens change.
 */
const THEME_SERIES_SEEDS = [
  '#00f5c4',
  '#ff4f9a',
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
