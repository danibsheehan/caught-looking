import { useThemePreference } from '../hooks/useThemePreference'

export default function ThemeToggle() {
  const { effective, setLight, setDark } = useThemePreference()

  return (
    <div
      className="theme-toggle"
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        className={
          effective === 'light'
            ? 'theme-toggle__btn theme-toggle__btn--active'
            : 'theme-toggle__btn'
        }
        onClick={setLight}
        aria-pressed={effective === 'light'}
      >
        Light
      </button>
      <button
        type="button"
        className={
          effective === 'dark'
            ? 'theme-toggle__btn theme-toggle__btn--active'
            : 'theme-toggle__btn'
        }
        onClick={setDark}
        aria-pressed={effective === 'dark'}
      >
        Dark
      </button>
    </div>
  )
}
