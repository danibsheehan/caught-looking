/**
 * Single-select from MLB clubs (typed against Go `/teams` rows).
 * @param {{
 *   id?: string,
 *   label?: string,
 *   teams: import('../../types/api').Team[],
 *   value: number | '',
 *   onChange: (teamId: number | '') => void,
 *   placeholder?: string,
 * }} props
 */
export default function TeamSelector({
  id = 'team-selector',
  label = 'Team',
  teams,
  value,
  onChange,
  placeholder = 'All teams',
}) {
  const sorted = [...teams].sort((a, b) =>
    a.abbreviation.localeCompare(b.abbreviation),
  )

  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <select
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
