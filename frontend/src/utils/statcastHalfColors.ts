import { adjustChartColorForSurface, relativeLuminance } from './chartColorContrast'
import { CHART_NEUTRAL_FALLBACK } from './mlbTeamColors'

/**
 * Fixed hues for Statcast game charts (spray + launch-angle): not team brand colors.
 * Blue/cyan vs orange reads clearly for color vision and keeps logic simple across themes.
 */
const AWAY_LIGHT = '#2563eb'
const HOME_LIGHT = '#c2410c'

const AWAY_DARK = '#38bdf8'
const HOME_DARK = '#fb923c'

const INK_MIN = 2.65

function surfaceIsDark(surfaceHex: string): boolean {
  const L = relativeLuminance(surfaceHex)
  if (L == null) return false
  return L < 0.22
}

function semanticSeeds(surfaceHex: string): { away: string; home: string } {
  return surfaceIsDark(surfaceHex)
    ? { away: AWAY_DARK, home: HOME_DARK }
    : { away: AWAY_LIGHT, home: HOME_LIGHT }
}

/**
 * Fill colors for away batting (top of inning) vs home batting (bottom).
 * Uses a fixed blue vs orange pair (theme-aware seeds), adjusted for contrast on the chart
 * surface only — not MLB team primaries, to avoid similar uniforms and heavy WCAG tuning here.
 *
 * Shapes (circle vs diamond on the spray chart) add a non-color cue for accessibility.
 */
export function statcastHalfFillColors(
  _awayTeamId: number | undefined,
  _homeTeamId: number | undefined,
  surfaceHex: string,
): { topHalf: string; bottomHalf: string; other: string } {
  const { away, home } = semanticSeeds(surfaceHex)
  return {
    topHalf: adjustChartColorForSurface(away, surfaceHex, INK_MIN),
    bottomHalf: adjustChartColorForSurface(home, surfaceHex, INK_MIN),
    other: adjustChartColorForSurface(CHART_NEUTRAL_FALLBACK, surfaceHex, INK_MIN),
  }
}
