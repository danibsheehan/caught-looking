import type { StatcastPitch } from '../types/api'

/** Plate half-width in feet (17 in / 2). */
export const PLATE_HALF_FT = 17 / 24

/** Fallback zone when per-pitch zone bounds are missing (feet). */
export const DEFAULT_SZ_BOT_FT = 1.5
export const DEFAULT_SZ_TOP_FT = 3.5

/** Normalized horizontal: plate_x in units of half-plate width (±1 ≈ plate edges). */
export const NORM_X_MIN = -1.35
export const NORM_X_MAX = 1.35
/** Normalized vertical: bottom of zone = 0, top = 1 (can extend outside). */
export const NORM_Z_MIN = -0.22
export const NORM_Z_MAX = 1.22

export function resolveStrikeZoneFeet(p: StatcastPitch): { bot: number; top: number } {
  const rawTop = p.szTop
  const rawBot = p.szBot
  if (
    rawTop != null &&
    rawBot != null &&
    Number.isFinite(rawTop) &&
    Number.isFinite(rawBot) &&
    rawTop > rawBot
  ) {
    return { bot: rawBot, top: rawTop }
  }
  return { bot: DEFAULT_SZ_BOT_FT, top: DEFAULT_SZ_TOP_FT }
}

/**
 * Map plate location to normalized strike-zone coordinates (catcher view).
 * - xN: horizontal in half-plate widths.
 * - zN: vertical where 0 = zone bottom, 1 = zone top (per-pitch sz_bot/sz_top when present).
 */
export function normalizedPlateLocation(p: StatcastPitch): { xN: number; zN: number } {
  const xN = p.plateX / PLATE_HALF_FT
  const { bot, top } = resolveStrikeZoneFeet(p)
  const span = top - bot
  const zN = span > 0 ? (p.plateZ - bot) / span : 0.5
  return { xN, zN }
}

/** Project normalized coords into SVG viewBox 0–100 (origin top-left; larger zN → higher on screen). */
export function projNormToSvg(xN: number, zN: number): { x: number; y: number } {
  const x = ((xN - NORM_X_MIN) / (NORM_X_MAX - NORM_X_MIN)) * 100
  const y = (1 - (zN - NORM_Z_MIN) / (NORM_Z_MAX - NORM_Z_MIN)) * 100
  return { x, y }
}

export function svgPointString(xN: number, zN: number): string {
  const { x, y } = projNormToSvg(xN, zN)
  return `${x},${y}`
}
