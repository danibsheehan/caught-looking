import type { Team } from '../../types/api.compat'

type TeamSelectorProps = {
  id?: string
  label?: string
  teams: Team[]
  value: number | ''
  onChange: (teamId: number | '') => void
  placeholder?: string
}

/** Single-select from MLB clubs (typed against Go `/teams` rows). */
export default function TeamSelector({
  id = 'team-selector',
  label = 'Team',
  teams,
  value,
  onChange,
  placeholder = 'All teams',
}: TeamSelectorProps) {
  const sorted = [...teams].sort((a, b) =>
    a.abbreviation.localeCompare(b.abbreviation),
  )

  return (
    <label className="form-field" htmlFor={id}>
      <span className="form-field__label">{label}</span>
      <select
        className="form-field__select"
        id={id}
        value={value === '' ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === '' ? '' : Number(v))
        }}
      >
        <option value="">{placeholder}</option>
        {sorted.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.abbreviation} — {t.teamName}
          </option>
        ))}
      </select>
    </label>
  )
}
