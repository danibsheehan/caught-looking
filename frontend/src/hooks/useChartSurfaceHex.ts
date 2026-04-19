import { useSyncExternalStore } from 'react'
import { chartSurfaceHexFromDocument } from '../utils/chartColorContrast'

function subscribeTheme(onStoreChange: () => void) {
  const el = document.documentElement
  const obs = new MutationObserver(onStoreChange)
  obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}

function getThemeSnapshot(): string {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/**
 * Hex background behind charts (resolved `html` background). Re-reads when
 * `data-theme` changes so series colors can re-contrast after toggling light/dark.
 */
export function useChartSurfaceHex(): string {
  useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => 'light')
  return chartSurfaceHexFromDocument()
}
