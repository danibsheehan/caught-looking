import { adjustChartColorForSurface } from './chartColorContrast'

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
export const CHART_COMPARISON_A = '#0ea5e9'
export const CHART_COMPARISON_B = '#f97316'
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
 * Assigns one stroke/fill color per team for a single chart, maximizing
 * pairwise separation while preferring each club’s primary, then secondary,
 * then a distinct reserve only when needed. Colors are then nudged toward black
 * or white so they meet {@link adjustChartColorForSurface} vs `surfaceHex`
 * (plot background).
 */
export function distinctChartColorsForTeamIds(
  teamIds: readonly number[],
  surfaceHex: string,
): string[] {
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

  return assigned.map((c) => adjustChartColorForSurface(c, surfaceHex))
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
  let secondary =
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
