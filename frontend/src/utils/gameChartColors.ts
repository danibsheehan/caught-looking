import { adjustChartColorForSurface, mixHex, relativeLuminance } from './chartColorContrast';
import {
  CHART_NEUTRAL_FALLBACK,
  CHART_NEUTRAL_FALLBACK_ALT,
  resolveGameScoreBarFills,
} from './mlbTeamColors';
import { getObsidianTeamColor } from './mlbTeamObsidianRegistry';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = hex.replace('#', '');
  if (n.length !== 6) return null;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r, g, b };
}

/** Gold / orange / yellow primaries — lift toward warm mid tones, not cool gray. */
function isWarmPrimaryHex(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return rgb.r > 88 && rgb.g > 72 && rgb.r + rgb.g > rgb.b * 1.75;
}

const BAR_SURFACE_MIN_CONTRAST = 2.35;

/**
 * Brightened fill for stacked “runs by inning” bars (Option A in mockup): dark
 * navies lift toward readable blue-grays; golds need a lighter mix only.
 */
export function liftBrandForInningStackedBar(brandHex: string, surfaceHex: string): string {
  const L = relativeLuminance(brandHex);
  if (L == null) {
    return adjustChartColorForSurface(brandHex, surfaceHex, BAR_SURFACE_MIN_CONTRAST);
  }
  const warm = isWarmPrimaryHex(brandHex);
  let lifted = brandHex;

  if (L < 0.13) {
    const pole = warm ? '#d8b038' : '#5a7aa8';
    const t = warm ? 0.48 : 0.58;
    lifted = mixHex(brandHex, pole, t);
  } else if (L < 0.28) {
    const pole = warm ? mixHex(brandHex, '#f0c850', 0.55) : mixHex(brandHex, '#a8c0e0', 0.5);
    lifted = mixHex(brandHex, pole, 0.42);
  } else {
    lifted = mixHex(brandHex, '#f2f4f0', 0.16);
  }

  return adjustChartColorForSurface(lifted, surfaceHex, BAR_SURFACE_MIN_CONTRAST);
}

/**
 * Away/home stacked bar fills from {@link resolveGameScoreBarFills}. When both teams are in the
 * obsidian registry, primaries are already adapted — only surface contrast is applied. Otherwise
 * raw brand hex is passed through {@link liftBrandForInningStackedBar}.
 */
export function gameInningBarFills(
  awayId: number | null | undefined,
  homeId: number | null | undefined,
  surfaceHex: string,
): { awayFill: string; homeFill: string } {
  const base = resolveGameScoreBarFills(
    awayId,
    homeId,
    CHART_NEUTRAL_FALLBACK,
    CHART_NEUTRAL_FALLBACK_ALT,
  );
  const registryBoth = getObsidianTeamColor(awayId) != null && getObsidianTeamColor(homeId) != null;
  const finalize = (hex: string) =>
    registryBoth
      ? adjustChartColorForSurface(hex, surfaceHex, BAR_SURFACE_MIN_CONTRAST)
      : liftBrandForInningStackedBar(hex, surfaceHex);
  return {
    awayFill: finalize(base.awayFill),
    homeFill: finalize(base.homeFill),
  };
}

const STATCAST_BIP_OTHER_INK = 2.65;

/**
 * Away (top half) vs home (bottom half) fills for game Statcast views — spray chart and
 * exit velocity × launch angle scatter. Uses the same lifted primaries as
 * {@link gameInningBarFills}. Inning-half unknown uses a neutral adjusted for the surface.
 */
export function gameStatcastHalfTeamFills(
  awayId: number | null | undefined,
  homeId: number | null | undefined,
  surfaceHex: string,
): { topHalf: string; bottomHalf: string; other: string } {
  const { awayFill, homeFill } = gameInningBarFills(awayId, homeId, surfaceHex);
  const other = adjustChartColorForSurface(
    CHART_NEUTRAL_FALLBACK,
    surfaceHex,
    STATCAST_BIP_OTHER_INK,
  );
  return { topHalf: awayFill, bottomHalf: homeFill, other };
}
