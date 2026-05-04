import {
  adjustChartColorForSurface,
  CHART_INK_MIN_CONTRAST,
  mixHex,
} from './chartColorContrast'
import { getObsidianTeamColor, resolveObsidianMatchupFills } from './mlbTeamObsidianRegistry'

/**
 * Primary / secondary brand hex for MLB Stats API team IDs.
 * Secondaries are chosen to contrast with common primaries (e.g. navy vs red)
 * so stacked charts stay readable when two clubs share a similar primary.
 *
 * Use these for **data ink** (bars, lines, game stacks). App chrome (nav, buttons)
 * should keep using CSS `--accent`; do not mix the two.
 */

/** Single-series or unknown-team fallback (slate), not the global UI accent. */
export const CHART_NEUTRAL_FALLBACK = '#64748b'

/** Second neutral when two fallbacks are needed (e.g. inning stack before IDs load). */
export const CHART_NEUTRAL_FALLBACK_ALT = '#94a3b8'

/** Two-player / two-series charts when team IDs are not passed (distinct from each other). */
export const CHART_COMPARISON_A = '#00f5c4'
export const CHART_COMPARISON_B = '#f472b6'
export const MLB_TEAM_PRIMARY_HEX = {
  108: '#BA0021',
  109: '#A71930',
  110: '#DF4601',
  111: '#BD3039',
  112: '#0E3386',
  113: '#C6011F',
  114: '#E31937',
  115: '#333366',
  116: '#0C2340',
  117: '#EB6E1F',
  118: '#004687',
  119: '#005A9C',
  120: '#AB0003',
  121: '#FF5910',
  133: '#003831',
  134: '#FDB827',
  135: '#FFC425',
  136: '#0C2C56',
  137: '#FD5A1E',
  138: '#C41E3A',
  139: '#092C5C',
  140: '#003278',
  141: '#134A8E',
  142: '#D31145',
  143: '#E81828',
  144: '#CE1141',
  145: '#27251F',
  146: '#00A3E0',
  147: '#132448',
  158: '#FFC52F',
} as const

/** Secondary / accent used when the opponent’s primary is too close on the spectrum. */
export const MLB_TEAM_SECONDARY_HEX = {
  108: '#003263',
  109: '#30CED8',
  110: '#000000',
  111: '#0C2340',
  112: '#CC3433',
  113: '#000000',
  114: '#0C2340',
  115: '#000000',
  116: '#FA4616',
  117: '#002D62',
  118: '#BD9B60',
  119: '#A5ACAF',
  120: '#14225A',
  121: '#002D72',
  133: '#EFB21E',
  134: '#000000',
  135: '#2F241D',
  136: '#005C5C',
  137: '#27251F',
  138: '#0C2340',
  139: '#8FBCE6',
  140: '#C0111F',
  141: '#E8291C',
  142: '#002B5C',
  143: '#003278',
  144: '#132448',
  145: '#C4CED4',
  146: '#EF3340',
  147: '#C4CED4',
  158: '#12284B',
} as const

type PrimaryKey = keyof typeof MLB_TEAM_PRIMARY_HEX
type SecondaryKey = keyof typeof MLB_TEAM_SECONDARY_HEX

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = hex.replace('#', '')
  if (n.length !== 6) return null
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  if ([r, g, b].some((x) => Number.isNaN(x))) return null
  return { r, g, b }
}

/** Euclidean distance in RGB; good enough to flag “both reds” type clashes. */
export function rgbDistance(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  if (!a || !b) return 255
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)
}

/** If primaries are at least this far apart, keep them (no secondary swap). */
const PRIMARY_OK_DISTANCE = 72

/**
 * Minimum RGB distance between any two colors in the same multi-team chart so
 * lines/bars remain easy to tell apart (slightly looser than one-on-one games).
 */
const MULTI_CHART_MIN_DISTANCE = 52

/**
 * When primaries/secondaries still clash, use these high-chroma strokes that
 * stay visible on light and dark chart backgrounds (avoid near-black).
 */
const CHART_DISTINCT_RESERVE: readonly string[] = [
  '#e11d48',
  '#2563eb',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0d9488',
  '#ea580c',
  '#4f46e5',
  '#db2777',
  '#0891b2',
]

function isNearBlackStroke(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return true
  return rgb.r + rgb.g + rgb.b < 90
}

function teamChartColorCandidates(teamId: number): string[] {
  if (!Number.isFinite(teamId) || teamId <= 0) {
    return [CHART_NEUTRAL_FALLBACK]
  }
  const obs = getObsidianTeamColor(teamId)
  if (obs) {
    const uniq = [obs.primary, obs.secondary].filter(
      (c, i, a) => c && a.indexOf(c) === i,
    )
    if (uniq.length > 0) return uniq
  }
  const p = MLB_TEAM_PRIMARY_HEX[teamId as PrimaryKey]
  const s = MLB_TEAM_SECONDARY_HEX[teamId as SecondaryKey]
  const out: string[] = []
  if (p) out.push(p)
  if (s && s !== p && !isNearBlackStroke(s)) out.push(s)
  if (out.length === 0) out.push(CHART_NEUTRAL_FALLBACK)
  return out
}

function minDistanceToAssigned(hex: string, assigned: string[]): number {
  if (assigned.length === 0) return 255
  let m = 255
  for (const a of assigned) {
    const d = rgbDistance(hex, a)
    if (d < m) m = d
  }
  return m
}

/**
 * Raw brand hex per team (same distinctness rules as multi-team charts), before
 * contrast adjustment — use for deriving obsidian ink/label pairs.
 */
export function pickDistinctChartBrandHexes(teamIds: readonly number[]): string[] {
  const assigned: string[] = []

  for (const id of teamIds) {
    const candidates = teamChartColorCandidates(id)
    const extended = [...candidates, ...CHART_DISTINCT_RESERVE]

    let best = candidates[0]
    let bestMinDist = minDistanceToAssigned(best, assigned)

    for (const c of extended) {
      if (isNearBlackStroke(c)) continue
      const m = minDistanceToAssigned(c, assigned)
      if (m >= MULTI_CHART_MIN_DISTANCE) {
        best = c
        bestMinDist = m
        break
      }
      if (m > bestMinDist) {
        best = c
        bestMinDist = m
      }
    }

    assigned.push(best)
  }

  return assigned
}

/**
 * Darken brand toward a **blue-slate** (not the page bg) so fills stay saturated
 * like the mockup (#1a2a40, #c05020, #8a1a1a) instead of muddy gray.
 */
const OBSIDIAN_INK_POLE = '#0e1828'
const INK_MIX_TOWARD_POLE = 0.38
/**
 * Looser than default chart ink — aggressive 3:1 nudging toward white mutes hue.
 */
const OBSIDIAN_INK_MIN_CONTRAST = 2.35

const LABEL_LIGHT_POLE = '#f1f5f9'
/** Keep chroma: mockup labels (#d06030, #c04040, #8ab0c8) read as team colors. */
const LABEL_MIX_TOWARD_LIGHT = 0.26
const LABEL_MIN_CONTRAST = 3.15

/** Pull contrast-adjusted hex back toward brand so orange/red/navy don’t go gray. */
function snapTowardBrand(adjusted: string, brand: string, t: number): string {
  return mixHex(adjusted, brand, t)
}

/**
 * Per-team pair: **ink** = darkened/saturated brand for strokes and bars on
 * obsidian; **label** = brighter brand for abbrev ticks, value labels, and
 * end-cap dots (see standings mockup).
 */
/** Map each team id to its registry label color (same order as `teamIds`). */
export function obsidianRegistryLabelMap(
  teamIds: readonly number[],
  surfaceHex: string,
): Map<number, string> {
  const pairs = obsidianTeamChartPairsRegistryPrimary(teamIds, surfaceHex)
  const m = new Map<number, string>()
  teamIds.forEach((id, i) => {
    m.set(id, pairs[i]?.label ?? '#c8d8e8')
  })
  return m
}

/**
 * Ink/label pairs using each team’s registry **primary** as the bar/line brand.
 * Use for division standings (strip + bars) so colors match {@link getObsidianTeamColor}
 * primaries. For charts that must force separation when many teams share a hue family,
 * use {@link obsidianTeamChartPairs} instead (distinctness swapping).
 */
export function obsidianTeamChartPairsRegistryPrimary(
  teamIds: readonly number[],
  surfaceHex: string,
): { ink: string; label: string }[] {
  return teamIds.map((teamId) => {
    const reg = getObsidianTeamColor(teamId)
    const brand = reg?.primary ?? mlbTeamPrimaryHex(teamId, CHART_NEUTRAL_FALLBACK)

    const inkBase = mixHex(brand, OBSIDIAN_INK_POLE, INK_MIX_TOWARD_POLE)
    const inkAdjusted = adjustChartColorForSurface(
      inkBase,
      surfaceHex,
      OBSIDIAN_INK_MIN_CONTRAST,
    )
    const ink = snapTowardBrand(inkAdjusted, brand, 0.22)

    if (reg) {
      const labelAdjusted = adjustChartColorForSurface(
        reg.label,
        surfaceHex,
        LABEL_MIN_CONTRAST,
      )
      const label = snapTowardBrand(labelAdjusted, reg.label, 0.28)
      return { ink, label }
    }

    const labelBase = mixHex(brand, LABEL_LIGHT_POLE, LABEL_MIX_TOWARD_LIGHT)
    const labelAdjusted = adjustChartColorForSurface(
      labelBase,
      surfaceHex,
      LABEL_MIN_CONTRAST,
    )
    const label = snapTowardBrand(labelAdjusted, brand, 0.35)
    return { ink, label }
  })
}

export function obsidianTeamChartPairs(
  teamIds: readonly number[],
  surfaceHex: string,
): { ink: string; label: string }[] {
  const brands = pickDistinctChartBrandHexes(teamIds)
  return teamIds.map((teamId, i) => {
    const brand = brands[i]!
    const reg = getObsidianTeamColor(teamId)
    const inkBase = mixHex(brand, OBSIDIAN_INK_POLE, INK_MIX_TOWARD_POLE)
    const inkAdjusted = adjustChartColorForSurface(
      inkBase,
      surfaceHex,
      OBSIDIAN_INK_MIN_CONTRAST,
    )
    const ink = snapTowardBrand(inkAdjusted, brand, 0.22)

    if (reg) {
      const labelAdjusted = adjustChartColorForSurface(
        reg.label,
        surfaceHex,
        LABEL_MIN_CONTRAST,
      )
      const label = snapTowardBrand(labelAdjusted, reg.label, 0.28)
      return { ink, label }
    }

    const labelBase = mixHex(brand, LABEL_LIGHT_POLE, LABEL_MIX_TOWARD_LIGHT)
    const labelAdjusted = adjustChartColorForSurface(
      labelBase,
      surfaceHex,
      LABEL_MIN_CONTRAST,
    )
    const label = snapTowardBrand(labelAdjusted, brand, 0.35)
    return { ink, label }
  })
}

/**
 * Assigns one stroke/fill color per team for a single chart, maximizing
 * pairwise separation while preferring each club’s primary, then secondary,
 * then a distinct reserve only when needed. Colors are then nudged toward black
 * or white so they meet {@link adjustChartColorForSurface} vs `surfaceHex`
 * (plot background).
 */
export function distinctChartColorsForTeamIds(
  teamIds: readonly number[],
  surfaceHex: string,
  inkMin: number = CHART_INK_MIN_CONTRAST,
): string[] {
  return pickDistinctChartBrandHexes(teamIds).map((c) =>
    adjustChartColorForSurface(c, surfaceHex, inkMin),
  )
}

/**
 * Pick away/home fills so the two stacked segments read as different colors.
 * Prefers both teams’ primaries when they are already distinct; otherwise tries
 * primary/secondary mixes and picks the pair with the largest separation.
 */
export function resolveGameScoreBarFills(
  awayId: number | null | undefined,
  homeId: number | null | undefined,
  fallbackAway: string,
  fallbackHome: string,
): { awayFill: string; homeFill: string } {
  const registryPair = resolveObsidianMatchupFills(awayId, homeId)
  if (registryPair) {
    return registryPair
  }

  const awayP =
    awayId != null && Number.isFinite(awayId) && awayId > 0
      ? MLB_TEAM_PRIMARY_HEX[awayId as PrimaryKey]
      : undefined
  const homeP =
    homeId != null && Number.isFinite(homeId) && homeId > 0
      ? MLB_TEAM_PRIMARY_HEX[homeId as PrimaryKey]
      : undefined
  const awayS =
    awayId != null && Number.isFinite(awayId) && awayId > 0
      ? MLB_TEAM_SECONDARY_HEX[awayId as SecondaryKey]
      : undefined
  const homeS =
    homeId != null && Number.isFinite(homeId) && homeId > 0
      ? MLB_TEAM_SECONDARY_HEX[homeId as SecondaryKey]
      : undefined

  const aP = awayP ?? fallbackAway
  const aS = awayS && awayS !== aP ? awayS : aP
  const hP = homeP ?? fallbackHome
  const hS = homeS && homeS !== hP ? homeS : hP

  const dPrimary = rgbDistance(aP, hP)
  if (dPrimary >= PRIMARY_OK_DISTANCE) {
    return { awayFill: aP, homeFill: hP }
  }

  const candidates = [
    { awayFill: aP, homeFill: hP, primaries: 2 },
    { awayFill: aP, homeFill: hS, primaries: 1 },
    { awayFill: aS, homeFill: hP, primaries: 1 },
    { awayFill: aS, homeFill: hS, primaries: 0 },
  ]

  let best = candidates[0]
  let bestDist = rgbDistance(best.awayFill, best.homeFill)
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]
    const d = rgbDistance(c.awayFill, c.homeFill)
    if (d > bestDist || (d === bestDist && c.primaries > best.primaries)) {
      best = c
      bestDist = d
    }
  }

  return { awayFill: best.awayFill, homeFill: best.homeFill }
}

export function mlbTeamPrimaryHex(
  teamId: number | null | undefined,
  fallback: string,
): string {
  if (teamId == null || !Number.isFinite(teamId) || teamId <= 0) return fallback
  return MLB_TEAM_PRIMARY_HEX[teamId as PrimaryKey] ?? fallback
}

/**
 * Team-branded pair for offense vs pitching/deep-dive charts: primary + secondary,
 * with a distinct reserve when the secondary is near-black or too close to primary.
 */
export function teamSplitChartColors(
  teamId: number | null | undefined,
  surfaceHex: string,
): { offense: string; defense: string } {
  const primary = mlbTeamPrimaryHex(teamId, CHART_NEUTRAL_FALLBACK)
  let secondary: string =
    MLB_TEAM_SECONDARY_HEX[teamId as SecondaryKey] ?? CHART_NEUTRAL_FALLBACK_ALT

  if (
    !secondary ||
    isNearBlackStroke(secondary) ||
    rgbDistance(primary, secondary) < MULTI_CHART_MIN_DISTANCE
  ) {
    secondary =
      CHART_DISTINCT_RESERVE.find(
        (c) =>
          rgbDistance(primary, c) >= MULTI_CHART_MIN_DISTANCE && !isNearBlackStroke(c),
      ) ?? CHART_COMPARISON_B
  }

  return {
    offense: adjustChartColorForSurface(primary, surfaceHex),
    defense: adjustChartColorForSurface(secondary, surfaceHex),
  }
}
