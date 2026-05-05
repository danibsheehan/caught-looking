import { useMemo } from 'react';
import { useChartSurfaceHex } from './useChartSurfaceHex';
import { adjustChartColorForSurface, CHART_INK_MIN_CONTRAST } from '../utils/chartColorContrast';
import {
  CHART_COMPARISON_A,
  CHART_COMPARISON_B,
  mlbTeamPrimaryHex,
  obsidianTeamChartPairs,
} from '../utils/mlbTeamColors';
import {
  getObsidianTeamColor,
  resolveObsidianMatchupFills,
} from '../utils/mlbTeamObsidianRegistry';

function registryChartInk(hex: string, surfaceHex: string): string {
  return adjustChartColorForSurface(hex, surfaceHex, CHART_INK_MIN_CONTRAST);
}

/** Obsidian registry matchup colors for series strokes/fills (hue-conflict + alphabetical rule). */
export function usePlayerCompareChartColors(
  teamId1: number | null | undefined,
  teamId2: number | null | undefined,
): { colorA: string; colorB: string } {
  const surfaceHex = useChartSurfaceHex();

  return useMemo(() => {
    const a = teamId1 != null && Number.isFinite(teamId1) && teamId1 > 0 ? teamId1 : null;
    const b = teamId2 != null && Number.isFinite(teamId2) && teamId2 > 0 ? teamId2 : null;

    const fallbackA = adjustChartColorForSurface(
      mlbTeamPrimaryHex(teamId1 ?? null, CHART_COMPARISON_A),
      surfaceHex,
    );
    const fallbackB = adjustChartColorForSurface(
      mlbTeamPrimaryHex(teamId2 ?? null, CHART_COMPARISON_B),
      surfaceHex,
    );

    if (a != null && b != null) {
      const matchup = resolveObsidianMatchupFills(a, b);
      if (matchup) {
        return {
          colorA: registryChartInk(matchup.awayFill, surfaceHex),
          colorB: registryChartInk(matchup.homeFill, surfaceHex),
        };
      }
      const [pa, pb] = obsidianTeamChartPairs([a, b], surfaceHex);
      return { colorA: pa.ink, colorB: pb.ink };
    }
    if (a != null) {
      const reg = getObsidianTeamColor(a);
      if (reg) {
        return {
          colorA: registryChartInk(reg.primary, surfaceHex),
          colorB: fallbackB,
        };
      }
      const [pa] = obsidianTeamChartPairs([a], surfaceHex);
      return { colorA: pa.ink, colorB: fallbackB };
    }
    if (b != null) {
      const reg = getObsidianTeamColor(b);
      if (reg) {
        return {
          colorA: fallbackA,
          colorB: registryChartInk(reg.primary, surfaceHex),
        };
      }
      const [pb] = obsidianTeamChartPairs([b], surfaceHex);
      return { colorA: fallbackA, colorB: pb.ink };
    }
    return { colorA: fallbackA, colorB: fallbackB };
  }, [teamId1, teamId2, surfaceHex]);
}
