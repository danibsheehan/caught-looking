import type { StatcastPitch } from '../types/api'

/** MLB / Savant pitch-type code → scatter color (strike zone & similar charts). */
export const PITCH_COLORS: Record<string, string> = {
  FF: '#ff6b6b', // 4-seam fastball
  FT: '#ff6b6b', // 2-seam fastball
  FC: '#f0a030', // cutter
  FS: '#f0a030', // splitter
  SL: '#00d4aa', // slider
  SW: '#00d4aa', // sweeper
  ST: '#00d4aa', // sweeper (Statcast code in some exports)
  CU: '#00d4aa', // curveball
  KC: '#00d4aa', // knuckle curve
  CH: '#a080d0', // changeup
  SI: '#6a8090', // sinker (secondary)
  KN: '#6a8090', // knuckleball
  EP: '#6a8090', // eephus / rare secondary
}

const FALLBACK_HEX = '#7a8494'

const PITCH_NAME_TO_CODE: Record<string, string> = {
  '4-seam fastball': 'FF',
  '4 seam fastball': 'FF',
  '2-seam fastball': 'FT',
  '2 seam fastball': 'FT',
  'two-seam fastball': 'FT',
  sinker: 'SI',
  cutter: 'FC',
  'split-finger': 'FS',
  splitter: 'FS',
  forkball: 'FS',
  slider: 'SL',
  sweeper: 'SW',
  curveball: 'CU',
  'knuckle curve': 'KC',
  changeup: 'CH',
  knuckleball: 'KN',
  eephus: 'EP',
}

function normalizePitchLabel(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Canonical pitch-type code for coloring: prefers API `pitchType`, else maps from `pitchName`.
 */
export function resolvePitchCode(p: StatcastPitch): string {
  const rawType = p.pitchType?.trim()
  if (rawType) {
    const u = rawType.toUpperCase()
    if (/^[A-Z][A-Z0-9]{0,2}$/.test(u)) {
      return u
    }
  }
  const name = p.pitchName?.trim()
  if (name) {
    const n = normalizePitchLabel(name)
    const fromMap = PITCH_NAME_TO_CODE[n]
    if (fromMap) {
      return fromMap
    }
    if (name.length <= 3 && /^[A-Za-z0-9]+$/.test(name)) {
      return name.toUpperCase()
    }
  }
  return 'UNK'
}

export function pitchHexForCode(code: string): string {
  return PITCH_COLORS[code] ?? FALLBACK_HEX
}

/** Per-code share of pitches in this sample (0–1 each). */
export function pitchShareByCode(pitches: StatcastPitch[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const p of pitches) {
    const c = resolvePitchCode(p)
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const n = pitches.length || 1
  const out = new Map<string, number>()
  for (const [k, v] of counts) {
    out.set(k, v / n)
  }
  return out
}

const OPACITY_MIN = 0.55
const OPACITY_MAX = 1

/** Map usage share (0–1) to dot opacity so common pitch types read brighter. */
export function opacityFromUsageShare(share: number): number {
  const s = Math.min(1, Math.max(0, share))
  return OPACITY_MIN + (OPACITY_MAX - OPACITY_MIN) * s
}

export function pitchMarkerFillStyle(
  p: StatcastPitch,
  shareByCode: Map<string, number>,
  opts?: { isolated?: boolean },
): { fill: string; fillOpacity: number } {
  const code = resolvePitchCode(p)
  let fillOpacity = opacityFromUsageShare(shareByCode.get(code) ?? 0)
  if (opts?.isolated) {
    fillOpacity = Math.max(fillOpacity, 0.92)
  }
  return {
    fill: pitchHexForCode(code),
    fillOpacity,
  }
}

/**
 * Stable color from a pitch label alone (e.g. legend or legacy callers).
 * Prefer `resolvePitchCode` + `pitchHexForCode` when a full `StatcastPitch` is available.
 */
export function pitchTypeColor(pitchName: string): string {
  const label = pitchName.trim() || 'Unknown'
  return pitchHexForCode(
    resolvePitchCode({ plateX: 0, plateZ: 0, pitcher: 0, pitchName: label }),
  )
}
