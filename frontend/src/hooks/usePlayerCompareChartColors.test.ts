import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePlayerCompareChartColors } from './usePlayerCompareChartColors'

const chartTest = vi.hoisted(() => ({
  surfaceHex: '#070b10',
}))

vi.mock('./useChartSurfaceHex', () => ({
  useChartSurfaceHex: () => chartTest.surfaceHex,
}))

describe('usePlayerCompareChartColors', () => {
  afterEach(() => {
    chartTest.surfaceHex = '#070b10'
  })

  it('returns distinct colors for two valid team ids', () => {
    const { result } = renderHook(() => usePlayerCompareChartColors(147, 121))

    expect(result.current.colorA).toMatch(/^#/)
    expect(result.current.colorB).toMatch(/^#/)
    expect(result.current.colorA).not.toBe(result.current.colorB)
  })

  it('uses comparison palette when a team id is missing', () => {
    const { result } = renderHook(() => usePlayerCompareChartColors(null, 121))

    expect(result.current.colorA).toMatch(/^#/)
    expect(result.current.colorB).toMatch(/^#/)
  })

  it('uses comparison palette when both team ids are missing', () => {
    const { result } = renderHook(() => usePlayerCompareChartColors(undefined, undefined))
    expect(result.current.colorA).toMatch(/^#/)
    expect(result.current.colorB).toMatch(/^#/)
  })

  it('treats non-positive and non-finite ids as missing', () => {
    const { result } = renderHook(() => usePlayerCompareChartColors(0, Number.NaN))
    expect(result.current.colorA).toMatch(/^#/)
    expect(result.current.colorB).toMatch(/^#/)
  })

  it('handles only first team (registry) when second is missing', () => {
    const { result } = renderHook(() => usePlayerCompareChartColors(113, null))
    expect(result.current.colorA).toMatch(/^#/)
    expect(result.current.colorB).toMatch(/^#/)
    expect(result.current.colorA).not.toBe(result.current.colorB)
  })

  it('handles only second team when first is missing', () => {
    const { result } = renderHook(() => usePlayerCompareChartColors(undefined, 119))
    expect(result.current.colorA).toMatch(/^#/)
    expect(result.current.colorB).toMatch(/^#/)
    expect(result.current.colorA).not.toBe(result.current.colorB)
  })

  it('uses secondary fill when both ids are the same team (matchup self-pair)', () => {
    const { result } = renderHook(() => usePlayerCompareChartColors(121, 121))
    expect(result.current.colorA).toMatch(/^#/)
    expect(result.current.colorB).toMatch(/^#/)
    expect(result.current.colorA).not.toBe(result.current.colorB)
  })

  it('falls back to chart pairs when both ids are unknown to the obsidian registry', () => {
    const { result } = renderHook(() => usePlayerCompareChartColors(9998, 9999))
    expect(result.current.colorA).toMatch(/^#/)
    expect(result.current.colorB).toMatch(/^#/)
    expect(result.current.colorA).not.toBe(result.current.colorB)
  })

  it('uses chart pairs for a single unknown team id', () => {
    const { result } = renderHook(() => usePlayerCompareChartColors(9999, null))
    expect(result.current.colorA).toMatch(/^#/)
    expect(result.current.colorB).toMatch(/^#/)
  })

  it('recomputes when chart surface hex changes', () => {
    const { result, rerender } = renderHook(() => usePlayerCompareChartColors(147, 121))
    const beforeA = result.current.colorA
    chartTest.surfaceHex = '#f5f5f5'
    rerender()
    expect(result.current.colorA).toMatch(/^#/)
    expect(result.current.colorA).not.toBe(beforeA)
  })
})
