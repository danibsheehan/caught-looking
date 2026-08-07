import { describe, expect, it } from 'vitest';
import { buildPlatoonBarData, platoonBarA11yRows } from './playerPlatoonBarRows';

describe('buildPlatoonBarData', () => {
  it('orders vl then vr and pairs both players', () => {
    const rows = buildPlatoonBarData(
      {
        id: 1,
        fullName: 'A',
        splits: [
          { code: 'vr', description: 'vs Right', ops: 0.8, sample: 100 },
          { code: 'vl', description: 'vs Left', ops: 0.9, sample: 40 },
        ],
      },
      {
        id: 2,
        fullName: 'B',
        splits: [{ code: 'vl', description: 'vs Left', ops: 1.0, sample: 30 }],
      },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].code).toBe('vl');
    expect(rows[0].opsPlayer1).toBe(0.9);
    expect(rows[0].opsPlayer2).toBe(1.0);
    expect(rows[1].code).toBe('vr');
    expect(rows[1].opsPlayer2).toBe(0);
  });
});

describe('platoonBarA11yRows', () => {
  it('formats OPS and sample sizes for the a11y table', () => {
    const { columns, rows } = platoonBarA11yRows(
      {
        id: 1,
        fullName: 'A',
        splits: [{ code: 'vl', description: 'vs Left', ops: 0.9, sample: 40 }],
      },
      {
        id: 2,
        fullName: 'B',
        splits: [{ code: 'vl', description: 'vs Left', ops: 1.0, sample: 30 }],
      },
      'A',
      'B',
    );
    expect(columns[0]).toBe('Split');
    expect(rows[0]).toEqual(['vs Left', '0.900', '40', '1.000', '30']);
  });
});
