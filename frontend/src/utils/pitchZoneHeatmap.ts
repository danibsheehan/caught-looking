import type { StatcastPitch } from '../types/api.compat';
import {
  NORM_X_MAX,
  NORM_X_MIN,
  NORM_Z_MAX,
  NORM_Z_MIN,
  normalizedPlateLocation,
} from './statcastPlateNormalized';

/** Default density grid over normalized catcher-view plate space. */
export const DEFAULT_HEAT_COLS = 6;
export const DEFAULT_HEAT_ROWS = 6;

export type PitchZoneHeatCell = {
  /** Column index, 0 = 3B side (negative plate_x). */
  col: number;
  /** Row index, 0 = low (toward the dirt / plate), increasing toward the pitcher. */
  row: number;
  count: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
};

export type PitchZoneHeatmap = {
  cols: number;
  rows: number;
  cells: PitchZoneHeatCell[];
  maxCount: number;
  pitchCount: number;
};

export type BuildPitchZoneHeatmapOptions = {
  cols?: number;
  rows?: number;
};

/**
 * Bin pitches into a regular grid in normalized plate space (same coords as the
 * strike-zone scatter). Pitches outside the plot window clamp into edge bins.
 */
export function buildPitchZoneHeatmap(
  pitches: StatcastPitch[],
  opts: BuildPitchZoneHeatmapOptions = {},
): PitchZoneHeatmap {
  const cols = Math.max(1, Math.floor(opts.cols ?? DEFAULT_HEAT_COLS));
  const rows = Math.max(1, Math.floor(opts.rows ?? DEFAULT_HEAT_ROWS));
  const spanX = NORM_X_MAX - NORM_X_MIN;
  const spanZ = NORM_Z_MAX - NORM_Z_MIN;
  const counts = new Array<number>(cols * rows).fill(0);
  let pitchCount = 0;

  for (const p of pitches) {
    if (!Number.isFinite(p.plateX) || !Number.isFinite(p.plateZ)) {
      continue;
    }
    const { xN, zN } = normalizedPlateLocation(p);
    const col = clampBinIndex(((xN - NORM_X_MIN) / spanX) * cols, cols);
    const row = clampBinIndex(((zN - NORM_Z_MIN) / spanZ) * rows, rows);
    counts[row * cols + col]! += 1;
    pitchCount += 1;
  }

  const cells: PitchZoneHeatCell[] = [];
  let maxCount = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const count = counts[row * cols + col]!;
      if (count > maxCount) maxCount = count;
      const x0 = NORM_X_MIN + (col / cols) * spanX;
      const x1 = NORM_X_MIN + ((col + 1) / cols) * spanX;
      const z0 = NORM_Z_MIN + (row / rows) * spanZ;
      const z1 = NORM_Z_MIN + ((row + 1) / rows) * spanZ;
      cells.push({ col, row, count, x0, x1, z0, z1 });
    }
  }

  return { cols, rows, cells, maxCount, pitchCount };
}

function clampBinIndex(raw: number, bins: number): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw >= bins) return bins - 1;
  return Math.floor(raw);
}

/** Perceptual fill opacity for a cell given the map's max count (teal accent). */
export function heatCellFillOpacity(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0;
  const t = Math.sqrt(count / maxCount);
  return 0.1 + 0.78 * t;
}

/** Non-zero cells for a11y tables, ordered high-z → low-z then 3B → 1B. */
export function heatCellsForDataTable(map: PitchZoneHeatmap): PitchZoneHeatCell[] {
  return map.cells.filter((c) => c.count > 0).sort((a, b) => b.row - a.row || a.col - b.col);
}
