import { describe, expect, it } from 'vitest';
import {
  chartA11yBattingSide,
  chartA11yFootnote,
  chartA11ySlice,
  CHART_A11Y_ROW_CAP,
} from './chartA11yRows';

describe('chartA11ySlice', () => {
  it('returns all rows when under the cap', () => {
    const slice = chartA11ySlice([1, 2, 3], 5);
    expect(slice).toEqual({ rows: [1, 2, 3], omitted: 0, total: 3 });
  });

  it('caps and reports omitted count', () => {
    const items = Array.from({ length: CHART_A11Y_ROW_CAP + 5 }, (_, i) => i);
    const slice = chartA11ySlice(items);
    expect(slice.rows).toHaveLength(CHART_A11Y_ROW_CAP);
    expect(slice.omitted).toBe(5);
    expect(slice.total).toBe(CHART_A11Y_ROW_CAP + 5);
  });
});

describe('chartA11yFootnote', () => {
  it('returns undefined when nothing was omitted', () => {
    expect(chartA11yFootnote('pitches', { omitted: 0, total: 10 })).toBeUndefined();
  });

  it('describes a truncated set', () => {
    expect(chartA11yFootnote('batted balls', { omitted: 10, total: 50 })).toBe(
      'Showing 40 of 50 batted balls.',
    );
  });
});

describe('chartA11yBattingSide', () => {
  it('maps top/bot to Away/Home', () => {
    expect(chartA11yBattingSide('Top')).toBe('Away');
    expect(chartA11yBattingSide('Bot')).toBe('Home');
    expect(chartA11yBattingSide('Bottom')).toBe('Home');
    expect(chartA11yBattingSide(undefined)).toBe('Unknown');
  });
});
