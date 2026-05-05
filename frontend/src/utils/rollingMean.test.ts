import { describe, expect, it } from 'vitest';
import { rollingTrailingMean } from './rollingMean';

describe('rollingTrailingMean', () => {
  it('uses partial window at the start', () => {
    expect(rollingTrailingMean([10, 20, 30], 2)).toEqual([10, 15, 25]);
  });

  it('treats window below 1 as 1', () => {
    expect(rollingTrailingMean([2, 4], 0)).toEqual([2, 4]);
  });

  it('returns empty for empty input', () => {
    expect(rollingTrailingMean([], 5)).toEqual([]);
  });
});
