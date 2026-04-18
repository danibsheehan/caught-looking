/**
 * Primary / secondary brand hex for MLB Stats API team IDs.
 * Secondaries are chosen to contrast with common primaries (e.g. navy vs red)
 * so stacked charts stay readable when two clubs share a similar primary.
 */
export const MLB_TEAM_PRIMARY_HEX = /** @type {const} */ ({
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
})

/** Secondary / accent used when the opponent’s primary is too close on the spectrum. */
export const MLB_TEAM_SECONDARY_HEX = /** @type {const} */ ({
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
})

/** @param {string} hex */
function hexToRgb(hex) {
  const n = hex.replace('#', '')
  if (n.length !== 6) return null
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  if ([r, g, b].some((x) => Number.isNaN(x))) return null
  return { r, g, b }
}

/**
 * Euclidean distance in RGB; good enough to flag “both reds” type clashes.
 * @param {string} hexA
 * @param {string} hexB
 */
export function rgbDistance(hexA, hexB) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  if (!a || !b) return 255
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)
}

/** If primaries are at least this far apart, keep them (no secondary swap). */
const PRIMARY_OK_DISTANCE = 72

/**
 * Pick away/home fills so the two stacked segments read as different colors.
 * Prefers both teams’ primaries when they are already distinct; otherwise tries
 * primary/secondary mixes and picks the pair with the largest separation.
 *
 * @param {number | null | undefined} awayId
 * @param {number | null | undefined} homeId
 * @param {string} fallbackAway
 * @param {string} fallbackHome
 * @returns {{ awayFill: string, homeFill: string }}
 */
export function resolveGameScoreBarFills(awayId, homeId, fallbackAway, fallbackHome) {
  const awayP =
    awayId != null && Number.isFinite(awayId) && awayId > 0
      ? MLB_TEAM_PRIMARY_HEX[/** @type {keyof typeof MLB_TEAM_PRIMARY_HEX} */ (awayId)]
      : undefined
  const homeP =
    homeId != null && Number.isFinite(homeId) && homeId > 0
      ? MLB_TEAM_PRIMARY_HEX[/** @type {keyof typeof MLB_TEAM_PRIMARY_HEX} */ (homeId)]
      : undefined
  const awayS =
    awayId != null && Number.isFinite(awayId) && awayId > 0
      ? MLB_TEAM_SECONDARY_HEX[/** @type {keyof typeof MLB_TEAM_SECONDARY_HEX} */ (awayId)]
      : undefined
  const homeS =
    homeId != null && Number.isFinite(homeId) && homeId > 0
      ? MLB_TEAM_SECONDARY_HEX[/** @type {keyof typeof MLB_TEAM_SECONDARY_HEX} */ (homeId)]
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

/**
 * @param {number | null | undefined} teamId
 * @param {string} fallback
 */
export function mlbTeamPrimaryHex(teamId, fallback) {
  if (teamId == null || !Number.isFinite(teamId) || teamId <= 0) return fallback
  return MLB_TEAM_PRIMARY_HEX[/** @type {keyof typeof MLB_TEAM_PRIMARY_HEX} */ (teamId)] ?? fallback
}
