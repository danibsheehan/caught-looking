import { describe, expect, it } from 'vitest';
import type { StatcastPitch } from '../types/api.compat';
import { DEFAULT_SZ_BOT_FT, DEFAULT_SZ_TOP_FT, PLATE_HALF_FT } from './statcastPlateNormalized';
import {
  buildPitchZoneHeatmap,
  heatCellFillOpacity,
  heatCellsForDataTable,
} from './pitchZoneHeatmap';

function pitchAtNorm(xN: number, zN: number, extra: Partial<StatcastPitch> = {}): StatcastPitch {
  const plateX = xN * PLATE_HALF_FT;
  const plateZ = DEFAULT_SZ_BOT_FT + zN * (DEFAULT_SZ_TOP_FT - DEFAULT_SZ_BOT_FT);
  return {
    plateX,
    plateZ,
    pitcher: 1,
    pitchType: 'FF',
    pitchName: '4-Seam Fastball',
    ...extra,
  };
}

describe('buildPitchZoneHeatmap', () => {
  it('bins pitches into a cols×rows grid and tracks max count', () => {
    const pitches = [pitchAtNorm(0, 0.5), pitchAtNorm(0, 0.5), pitchAtNorm(-0.8, 0.2)];
    const map = buildPitchZoneHeatmap(pitches, { cols: 3, rows: 3 });
    expect(map.cols).toBe(3);
    expect(map.rows).toBe(3);
    expect(map.cells).toHaveLength(9);
    expect(map.pitchCount).toBe(3);
    expect(map.maxCount).toBe(2);
    expect(map.cells.reduce((n, c) => n + c.count, 0)).toBe(3);
  });

  it('clamps pitches outside the plot window into edge bins', () => {
    const map = buildPitchZoneHeatmap([pitchAtNorm(-5, 3)], { cols: 2, rows: 2 });
    expect(map.pitchCount).toBe(1);
    expect(map.cells.filter((c) => c.count > 0)).toHaveLength(1);
    const hit = map.cells.find((c) => c.count === 1)!;
    expect(hit.col).toBe(0);
    expect(hit.row).toBe(1);
  });

  it('skips non-finite plate coordinates', () => {
    const map = buildPitchZoneHeatmap([
      { plateX: Number.NaN, plateZ: 2, pitcher: 1 },
      pitchAtNorm(0, 0.5),
    ]);
    expect(map.pitchCount).toBe(1);
  });
});

describe('heatCellFillOpacity', () => {
  it('returns 0 for empty cells and scales with sqrt density', () => {
    expect(heatCellFillOpacity(0, 4)).toBe(0);
    expect(heatCellFillOpacity(4, 4)).toBeCloseTo(0.88);
    expect(heatCellFillOpacity(1, 4)).toBeCloseTo(0.1 + 0.78 * 0.5);
  });
});

describe('heatCellsForDataTable', () => {
  it('keeps non-zero cells sorted catcher-high then 3B→1B', () => {
    const map = buildPitchZoneHeatmap(
      [pitchAtNorm(-0.8, 0.9), pitchAtNorm(0.8, 0.1), pitchAtNorm(-0.8, 0.1)],
      { cols: 2, rows: 2 },
    );
    const rows = heatCellsForDataTable(map);
    expect(rows.every((c) => c.count > 0)).toBe(true);
    expect(rows[0]!.row).toBeGreaterThanOrEqual(rows[rows.length - 1]!.row);
  });
});
