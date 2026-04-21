import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adjustChartColorForSurface,
  CHART_INK_MIN_CONTRAST,
  chartSurfaceHexFromDocument,
  contrastRatio,
  relativeLuminance,
} from './chartColorContrast'

describe('relativeLuminance', () => {
  it('returns luminance for 6-digit hex', () => {
    const L = relativeLuminance('#ffffff')
    expect(L).not.toBeNull()
    expect(L!).toBeGreaterThan(0.99)
  })

  it('returns null for invalid hex', () => {
    expect(relativeLuminance('not-a-color')).toBeNull()
    expect(relativeLuminance('#fff')).toBeNull()
  })
})

describe('contrastRatio', () => {
  it('returns ~21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('returns 1 when either color is invalid', () => {
    expect(contrastRatio('bad', '#ffffff')).toBe(1)
    expect(contrastRatio('#000000', 'bad')).toBe(1)
  })
})

describe('adjustChartColorForSurface', () => {
  it('returns original color when contrast already meets minimum', () => {
    const fg = '#000000'
    expect(adjustChartColorForSurface(fg, '#ffffff', CHART_INK_MIN_CONTRAST)).toBe(fg)
  })

  it('darkens light yellow on white until ratio is met', () => {
    const out = adjustChartColorForSurface('#ffff00', '#ffffff', CHART_INK_MIN_CONTRAST)
    expect(out).not.toBe('#ffff00')
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(CHART_INK_MIN_CONTRAST - 1e-6)
  })
})

describe('chartSurfaceHexFromDocument', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses rgb() from getComputedStyle', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      backgroundColor: 'rgb(17, 24, 39)',
    } as CSSStyleDeclaration)

    expect(chartSurfaceHexFromDocument()).toBe('#111827')
  })

  it('falls back to app default surface when background is not parseable', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      backgroundColor: 'transparent',
    } as CSSStyleDeclaration)

    expect(chartSurfaceHexFromDocument()).toBe('#070b10')
  })
})
