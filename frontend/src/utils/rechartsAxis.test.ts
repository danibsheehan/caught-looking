import { describe, expect, it } from 'vitest'
import { chartCartesianTick, polarAxisTickSans } from './rechartsAxis'

describe('rechartsAxis tick style tokens', () => {
  it.each([
    {
      name: 'chartCartesianTick',
      value: chartCartesianTick,
      expected: {
        fill: 'var(--chart-tick)',
        fontSize: 11,
        fontFamily: 'var(--mono)',
      },
    },
    {
      name: 'polarAxisTickSans',
      value: polarAxisTickSans,
      expected: {
        fill: 'var(--text)',
        fontSize: 11,
        fontFamily: 'var(--sans)',
      },
    },
  ] as const)('$name matches shared axis contract', ({ value, expected }) => {
    expect(value).toEqual(expected)
  })

  it('uses mono for cartesian values and sans for polar labels', () => {
    expect(chartCartesianTick.fontFamily).toBe('var(--mono)')
    expect(polarAxisTickSans.fontFamily).toBe('var(--sans)')
    expect(chartCartesianTick.fill).not.toBe(polarAxisTickSans.fill)
  })
})
