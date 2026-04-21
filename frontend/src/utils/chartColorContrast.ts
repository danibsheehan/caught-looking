/**
 * Bump MLB / chart hex colors so they meet a minimum contrast ratio against the
 * plot surface (usually `html` background). Preserves hue as much as possible
 * by mixing toward #000 or #fff.
 *
 * WCAG: use ~3:1 for non-text chart ink (1.4.11-style discrimination); 4.5:1
 * is often impractical for yellow / light gold brand colors on white.
 */

/** Default minimum contrast vs chart surface for series ink (bars/lines/fills). */
export const CHART_INK_MIN_CONTRAST = 3

function parseRgbCss(css: string): { r: number; g: number; b: number } | null {
  const m = css.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  )
  if (!m) return null
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  if ([r, g, b].some((x) => Number.isNaN(x))) return null
  return { r, g, b }
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => clampByte(x).toString(16).padStart(2, '0')).join('')}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = hex.replace('#', '')
  if (n.length !== 6) return null
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  if ([r, g, b].some((x) => Number.isNaN(x))) return null
  return { r, g, b }
}

function linearize(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.2 relative luminance. */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const r = linearize(rgb.r)
  const g = linearize(rgb.g)
  const b = linearize(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const L1 = relativeLuminance(fgHex)
  const L2 = relativeLuminance(bgHex)
  if (L1 == null || L2 == null) return 1
  const hi = Math.max(L1, L2)
  const lo = Math.min(L1, L2)
  return (hi + 0.05) / (lo + 0.05)
}

/** Linear RGB mix between two hex colors (`t`=0 → `fg`, `t`=1 → `pole`). */
export function mixHex(fg: string, pole: string, t: number): string {
  const a = hexToRgb(fg)
  const b = hexToRgb(pole)
  if (!a || !b) return fg
  const u = Math.max(0, Math.min(1, t))
  return rgbToHex(
    a.r + (b.r - a.r) * u,
    a.g + (b.g - a.g) * u,
    a.b + (b.b - a.b) * u,
  )
}

/**
 * Adjust `fg` until it has at least `minRatio` contrast vs `surfaceHex`,
 * mixing toward #000000 or #ffffff as needed.
 */
export function adjustChartColorForSurface(
  fgHex: string,
  surfaceHex: string,
  minRatio: number = CHART_INK_MIN_CONTRAST,
): string {
  if (contrastRatio(fgHex, surfaceHex) >= minRatio) return fgHex

  let best = fgHex
  let bestR = contrastRatio(fgHex, surfaceHex)

  for (const pole of ['#000000', '#ffffff'] as const) {
    for (let t = 0.02; t <= 1; t += 0.02) {
      const c = mixHex(fgHex, pole, t)
      const r = contrastRatio(c, surfaceHex)
      if (r >= minRatio) return c
      if (r > bestR) {
        best = c
        bestR = r
      }
    }
  }

  return best
}

/** Resolved `html` background as hex (matches CSS `background` on :root). */
/** Matches `frontend/src/styles/_base.scss` `--bg` when CSS is unavailable. */
const CHART_SURFACE_FALLBACK = '#070b10'

export function chartSurfaceHexFromDocument(): string {
  if (typeof document === 'undefined') return CHART_SURFACE_FALLBACK
  const css = getComputedStyle(document.documentElement).backgroundColor
  const rgb = parseRgbCss(css)
  if (rgb) return rgbToHex(rgb.r, rgb.g, rgb.b)
  return CHART_SURFACE_FALLBACK
}
