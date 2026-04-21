import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePlayerCompareChartColors } from './usePlayerCompareChartColors'

vi.mock('./useChartSurfaceHex', () => ({
  useChartSurfaceHex: () => '#070b10',
}))

describe('usePlayerCompareChartColors', () => {
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
})
