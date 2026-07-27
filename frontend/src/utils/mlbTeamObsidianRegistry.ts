import { mixHex } from './chartColorContrast';

/**
 * Neon-on-Obsidian adapted palette per MLB Stats API team id (see design registry).
 * - **primary** — bar fill, line stroke (already tuned for dark UI)
 * - **secondary** — same-family matchup fallback when primaries are hue-conflicts
 * - **label** — brighter ink for abbrev / axis ticks
 * - **tint** — ~8% primary over obsidian bg (score cards, selected states)
 */
export type TeamColorTag = 'lifted' | 'desat' | 'ok';

export type TeamObsidianColorEntry = {
  abbrev: string;
  primary: string;
  secondary: string;
  label: string;
  tint: string;
  tag: TeamColorTag;
};

const OBSIDIAN_BG = '#070b10';

/** Minimum circular hue separation (degrees) before two primaries can both be used as fills. */
export const MATCHUP_HUE_CONFLICT_DEG = 30;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = hex.replace('#', '');
  if (n.length !== 6) return null;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r, g, b };
}

/** Hue in [0, 360) for conflict checks (cheap perceptual proxy per design doc). */
export function hexHueDegrees(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 1e-6) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

/** Circular distance between hues in degrees. */
export function circularHueDistanceDeg(hexA: string, hexB: string): number {
  const a = hexHueDegrees(hexA);
  const b = hexHueDegrees(hexB);
  if (a == null || b == null) return 180;
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

function makeTint(primary: string): string {
  return mixHex(primary, OBSIDIAN_BG, 0.08);
}

function entry(
  abbrev: string,
  primary: string,
  secondary: string,
  label: string,
  tag: TeamColorTag,
): TeamObsidianColorEntry {
  return {
    abbrev,
    primary,
    secondary,
    label,
    tint: makeTint(primary),
    tag,
  };
}

/** All 30 franchises keyed by Stats API `team.id` (aligned with `MLB_TEAM_PRIMARY_HEX` keys). */
export const MLB_TEAM_OBSIDIAN_REGISTRY: Readonly<Record<number, TeamObsidianColorEntry>> = {
  108: entry('LAA', '#c03030', '#7eb0d8', '#6090b0', 'desat'),
  109: entry('ARI', '#a02060', '#50b8d8', '#9060b0', 'ok'),
  110: entry('BAL', '#c05020', '#ffd090', '#d06030', 'desat'),
  111: entry('BOS', '#c03030', '#e8a030', '#c89020', 'desat'),
  112: entry('CHC', '#2060a0', '#b8e0ff', '#4a80b0', 'lifted'),
  113: entry('CIN', '#c02020', '#ffb8a0', '#c04040', 'desat'),
  114: entry('CLE', '#c03020', '#ffd858', '#d08010', 'desat'),
  115: entry('COL', '#7050a0', '#e0c8f0', '#8050a0', 'lifted'),
  116: entry('DET', '#1a5a9a', '#90d0ff', '#4a90c0', 'lifted'),
  117: entry('HOU', '#c84020', '#ffe8c0', '#c84020', 'ok'),
  118: entry('KC', '#1a4a8a', '#e8d8b0', '#c89020', 'lifted'),
  119: entry('LAD', '#1a60b0', '#98d8ff', '#4090b0', 'lifted'),
  120: entry('WSH', '#b01818', '#f0c8d0', '#8090b0', 'lifted'),
  121: entry('NYM', '#1060a0', '#a8d8ff', '#4a80b0', 'lifted'),
  133: entry('OAK', '#c89020', '#2a4834', '#c89020', 'ok'),
  134: entry('SD', '#b08040', '#402818', '#c0a060', 'ok'),
  135: entry('PIT', '#d0a010', '#4a3818', '#d0c070', 'ok'),
  136: entry('SEA', '#3a5a8a', '#c8e8f8', '#3a8090', 'lifted'),
  137: entry('SF', '#c84010', '#ffe8a8', '#f0a010', 'ok'),
  138: entry('STL', '#c02828', '#ffd8e0', '#c04040', 'desat'),
  139: entry('TB', '#4a8aaa', '#d0f0ff', '#8ab0c8', 'lifted'),
  140: entry('TEX', '#1a4a8a', '#e0d0b0', '#c0b080', 'lifted'),
  141: entry('TOR', '#2878c0', '#b8e8ff', '#5090c0', 'ok'),
  142: entry('MIN', '#b02020', '#f8e8c8', '#c0c8a0', 'lifted'),
  143: entry('PHI', '#c82020', '#ffd8c0', '#c0b060', 'desat'),
  144: entry('ATL', '#c03030', '#ffd0c8', '#c03060', 'desat'),
  145: entry('CWS', '#6a7a8a', '#e8eef2', '#c0d0e0', 'lifted'),
  146: entry('MIA', '#e05010', '#ffd8c0', '#3060a0', 'ok'),
  147: entry('NYY', '#3a5a8a', '#c0d8f0', '#c8d8e8', 'lifted'),
  158: entry('MIL', '#1a4a8a', '#b0d8f0', '#5090b0', 'lifted'),
};

export function getObsidianTeamColor(
  teamId: number | null | undefined,
): TeamObsidianColorEntry | null {
  if (teamId == null || !Number.isFinite(teamId) || teamId <= 0) return null;
  return MLB_TEAM_OBSIDIAN_REGISTRY[teamId] ?? null;
}

/**
 * When two primaries are too close in hue, the team that sorts **earlier by `abbrev`**
 * keeps {@link TeamObsidianColorEntry.primary}; the other uses {@link TeamObsidianColorEntry.secondary}
 * as the matchup fill (design rule 3).
 */
export function resolveObsidianMatchupFills(
  awayId: number | null | undefined,
  homeId: number | null | undefined,
): { awayFill: string; homeFill: string } | null {
  const away = getObsidianTeamColor(awayId);
  const home = getObsidianTeamColor(homeId);
  if (!away || !home) return null;

  if (awayId != null && homeId != null && awayId === homeId) {
    return { awayFill: away.primary, homeFill: away.secondary };
  }

  const hueD = circularHueDistanceDeg(away.primary, home.primary);
  if (hueD >= MATCHUP_HUE_CONFLICT_DEG) {
    return { awayFill: away.primary, homeFill: home.primary };
  }

  const first = away.abbrev.localeCompare(home.abbrev, 'en') <= 0 ? away : home;
  const second = first.abbrev === away.abbrev ? home : away;

  return {
    awayFill: away.abbrev === first.abbrev ? first.primary : second.secondary,
    homeFill: home.abbrev === first.abbrev ? first.primary : second.secondary,
  };
}
