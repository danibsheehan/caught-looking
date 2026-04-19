import { useMemo } from 'react'
import { useChartSurfaceHex } from './useChartSurfaceHex'
import { adjustChartColorForSurface } from '../utils/chartColorContrast'
import {
  CHART_COMPARISON_A,
  CHART_COMPARISON_B,
  distinctChartColorsForTeamIds,
  mlbTeamPrimaryHex,
} from '../utils/mlbTeamColors'

/** Same palette rules as {@link PlayerRadar} (team primaries vs default comparison pair). */
export function usePlayerCompareChartColors(
  teamId1: number | null | undefined,
  teamId2: number | null | undefined,
): { colorA: string; colorB: string } {
  const surfaceHex = useChartSurfaceHex()

  return useMemo(() => {
    const a =
      teamId1 != null && Number.isFinite(teamId1) && teamId1 > 0 ? teamId1 : null
    const b =
      teamId2 != null && Number.isFinite(teamId2) && teamId2 > 0 ? teamId2 : null
    if (a != null && b != null) {
      const [ca, cb] = distinctChartColorsForTeamIds([a, b], surfaceHex)
      return { colorA: ca, colorB: cb }
    }
    return {
      colorA: adjustChartColorForSurface(
        mlbTeamPrimaryHex(teamId1 ?? null, CHART_COMPARISON_A),
        surfaceHex,
      ),
      colorB: adjustChartColorForSurface(
        mlbTeamPrimaryHex(teamId2 ?? null, CHART_COMPARISON_B),
        surfaceHex,
      ),
    }
  }, [teamId1, teamId2, surfaceHex])
}
