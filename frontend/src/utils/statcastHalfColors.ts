import {
  adjustChartColorForSurface,
  contrastRatio,
  relativeLuminance,
} from './chartColorContrast'
import {
  CHART_NEUTRAL_FALLBACK,
  distinctChartColorsForTeamIds,
  mlbTeamPrimaryHex,
  resolveGameScoreBarFills,
} from './mlbTeamColors'

/** Light-theme seeds (saturated; cool vs warm). */
const SEMANTIC_AWAY_LIGHT = '#2563eb'
const SEMANTIC_HOME_LIGHT = '#c2410c'

/**
 * Dark-theme seeds: cyan vs orange (well separated); on dark surfaces, aggressive
 * `adjustChartColorForSurface` can otherwise mix both toward the same near-white.
 */
const SEMANTIC_AWAY_DARK = '#22d3ee'
const SEMANTIC_HOME_DARK = '#f97316'

const INK_MIN = 2.65

/** Pairwise: two adjusted series must not collapse to the same ink. */
const PAIR_MIN_RATIO = 1.15

function surfaceIsDark(surfaceHex: string): boolean {
  const L = relativeLuminance(surfaceHex)
  if (L == null) return false
  return L < 0.22
}

function semanticSeeds(surfaceHex: string): { away: string; home: string } {
  return surfaceIsDark(surfaceHex)
    ? { away: SEMANTIC_AWAY_DARK, home: SEMANTIC_HOME_DARK }
    : { away: SEMANTIC_AWAY_LIGHT, home: SEMANTIC_HOME_LIGHT }
}

/**
 * Adjust two inks for the plot surface while keeping them distinguishable from each other.
 * Relaxes minimum contrast vs background stepwise so team hues are not replaced by generics.
 */
function adjustPairForSurface(
  awayHex: string,
  homeHex: string,
  surfaceHex: string,
): { away: string; home: string } {
  const inkSteps = [INK_MIN, 2.4, 2.2, 2, 1.75, 1.5, 1.35, 1.25]
  for (const m of inkSteps) {
    const a = adjustChartColorForSurface(awayHex, surfaceHex, m)
    const h = adjustChartColorForSurface(homeHex, surfaceHex, m)
    if (contrastRatio(a, h) >= PAIR_MIN_RATIO) {
      return { away: a, home: h }
    }
  }
  const a = adjustChartColorForSurface(awayHex, surfaceHex, 1.25)
  const h = adjustChartColorForSurface(homeHex, surfaceHex, 1.25)
  return { away: a, home: h }
}

/**
 * Fill colors for away batting vs home batting (top vs bottom of inning).
 * Uses team primaries (and primary/secondary mixes when primaries clash); semantic
 * cool/warm pair only when team IDs are unknown.
 */
export function statcastHalfFillColors(
  awayTeamId: number | undefined,
  homeTeamId: number | undefined,
  surfaceHex: string,
): { topHalf: string; bottomHalf: string; other: string } {
  const seeds = semanticSeeds(surfaceHex)
  const other = adjustChartColorForSurface(CHART_NEUTRAL_FALLBACK, surfaceHex, INK_MIN)

  const hasAway = awayTeamId != null && awayTeamId > 0
  const hasHome = homeTeamId != null && homeTeamId > 0

  if (hasAway && hasHome) {
    const { awayFill, homeFill } = resolveGameScoreBarFills(
      awayTeamId,
      homeTeamId,
      seeds.away,
      seeds.home,
    )
    let { away, home } = adjustPairForSurface(awayFill, homeFill, surfaceHex)

    if (contrastRatio(away, home) < PAIR_MIN_RATIO) {
      const inkMins = [INK_MIN, 2, 1.5, 1.25]
      for (const inkMin of inkMins) {
        const [a2, h2] = distinctChartColorsForTeamIds(
          [awayTeamId, homeTeamId],
          surfaceHex,
          inkMin,
        )
        if (contrastRatio(a2, h2) >= PAIR_MIN_RATIO) {
          away = a2
          home = h2
          break
        }
        away = a2
        home = h2
      }
    }

    return { topHalf: away, bottomHalf: home, other }
  }

  const awayBase = hasAway
    ? mlbTeamPrimaryHex(awayTeamId, seeds.away)
    : seeds.away
  const homeBase = hasHome
    ? mlbTeamPrimaryHex(homeTeamId, seeds.home)
    : seeds.home

  let { away, home } = adjustPairForSurface(awayBase, homeBase, surfaceHex)

  if (contrastRatio(away, home) < 1.25) {
    away = awayBase
    home = homeBase
  }

  return { topHalf: away, bottomHalf: home, other }
}
