import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  applyEffectiveTheme,
  readStoredThemePreference,
  resolveEffectiveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '../theme'

function getSystemDarkSnapshot() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function subscribeSystemDark(onStoreChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onStoreChange)
  return () => mq.removeEventListener('change', onStoreChange)
}

export function useThemePreference() {
  const prefersDark = useSyncExternalStore(
    subscribeSystemDark,
    getSystemDarkSnapshot,
    () => false,
  )

  const [preference, setPreferenceState] = useState<ThemePreference>(
    readStoredThemePreference,
  )

  const effective = resolveEffectiveTheme(preference, prefersDark)

  useEffect(() => {
    applyEffectiveTheme(effective)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference)
    } catch {
      /* ignore */
    }
  }, [preference, effective])

  const setLight = useCallback(() => {
    setPreferenceState((p) => (p === 'light' ? 'system' : 'light'))
  }, [])

  const setDark = useCallback(() => {
    setPreferenceState((p) => (p === 'dark' ? 'system' : 'dark'))
  }, [])

  return { preference, effective, setLight, setDark }
}
