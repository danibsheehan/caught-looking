import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chartSurfaceHexFromDocument } from '../utils/chartColorContrast'
import { useChartSurfaceHex } from './useChartSurfaceHex'

describe('useChartSurfaceHex', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the same hex as chartSurfaceHexFromDocument for the active document styles', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      backgroundColor: 'rgb(17, 24, 39)',
    } as CSSStyleDeclaration)

    const { result } = renderHook(() => useChartSurfaceHex())
    expect(result.current).toBe(chartSurfaceHexFromDocument())
    expect(result.current).toBe('#111827')
  })

  it('falls back when html background is not a parseable rgb()', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      backgroundColor: 'transparent',
    } as CSSStyleDeclaration)

    const { result } = renderHook(() => useChartSurfaceHex())
    expect(result.current).toBe('#070b10')
  })

  it('re-reads surface hex on rerender when computed styles change', () => {
    const spy = vi.spyOn(window, 'getComputedStyle')
    spy.mockReturnValueOnce({
      backgroundColor: 'rgb(0, 0, 0)',
    } as CSSStyleDeclaration)
    spy.mockReturnValueOnce({
      backgroundColor: 'rgb(255, 255, 255)',
    } as CSSStyleDeclaration)

    const { result, rerender } = renderHook(() => useChartSurfaceHex())
    expect(result.current).toBe('#000000')
    rerender()
    expect(result.current).toBe('#ffffff')
  })
})
