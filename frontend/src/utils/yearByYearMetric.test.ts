import { describe, expect, it } from 'vitest'
import type { YearByYearMetric } from '../types/api.compat'
import {
  formatYearByYearAxisValue,
  formatYearByYearTooltipValue,
  HITTING_CAREER_METRICS,
  PITCHING_CAREER_METRICS,
  yearByYearMetricShortLabel,
} from './yearByYearMetric'

describe('yearByYearMetricShortLabel', () => {
  it.each<[YearByYearMetric, string]>([
    ['ops', 'OPS'],
    ['avg', 'AVG'],
    ['obp', 'OBP'],
    ['slg', 'SLG'],
    ['woba', 'wOBA'],
    ['era', 'ERA'],
    ['whip', 'WHIP'],
    ['k9', 'K/9'],
    ['bb9', 'BB/9'],
    ['fip', 'FIP'],
  ])('%s → %s', (metric, expected) => {
    expect(yearByYearMetricShortLabel(metric)).toBe(expected)
  })
})

describe('formatYearByYearAxisValue', () => {
  it.each<[YearByYearMetric, number, string]>([
    ['ops', 0.823, '0.823'],
    ['avg', 0.285, '0.285'],
    ['obp', 0.4, '0.400'],
    ['slg', 0.5, '0.500'],
    ['woba', 0.35, '0.350'],
    ['era', 3.456, '3.46'],
    ['whip', 1.2, '1.20'],
    ['k9', 9.876, '9.88'],
    ['bb9', 2.1, '2.10'],
    ['fip', 4, '4.00'],
  ])('%s formats %s as %s', (metric, value, expected) => {
    expect(formatYearByYearAxisValue(metric, value)).toBe(expected)
  })
})

describe('formatYearByYearTooltipValue', () => {
  it.each<[string, number | null | undefined]>([
    ['null', null],
    ['undefined', undefined],
    ['NaN', NaN],
  ])('returns em dash for %s', (_, v) => {
    expect(formatYearByYearTooltipValue('ops', v)).toBe('—')
  })

  it('delegates finite values to axis formatter', () => {
    expect(formatYearByYearTooltipValue('era', 2.5)).toBe('2.50')
    expect(formatYearByYearTooltipValue('ops', 1)).toBe('1.000')
  })
})

describe('career metric option lists', () => {
  it('lists hitting metrics with display labels', () => {
    expect(HITTING_CAREER_METRICS).toEqual([
      { value: 'ops', label: 'OPS' },
      { value: 'avg', label: 'AVG' },
      { value: 'obp', label: 'OBP' },
      { value: 'slg', label: 'SLG' },
      { value: 'woba', label: 'wOBA' },
    ])
  })

  it('lists pitching metrics with display labels', () => {
    expect(PITCHING_CAREER_METRICS).toEqual([
      { value: 'era', label: 'ERA' },
      { value: 'whip', label: 'WHIP' },
      { value: 'k9', label: 'K/9' },
      { value: 'bb9', label: 'BB/9' },
      { value: 'fip', label: 'FIP' },
    ])
  })

  it('keeps unique metric values across both lists', () => {
    const hitting = new Set(HITTING_CAREER_METRICS.map((x) => x.value))
    const pitching = new Set(PITCHING_CAREER_METRICS.map((x) => x.value))
    expect(hitting.size).toBe(HITTING_CAREER_METRICS.length)
    expect(pitching.size).toBe(PITCHING_CAREER_METRICS.length)
    for (const v of pitching) {
      expect(hitting.has(v)).toBe(false)
    }
  })
})
