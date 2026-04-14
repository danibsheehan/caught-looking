/**
 * Compact label + metric for dashboards.
 * @param {{ label: string, value: string | number, hint?: string }} props
 */
export default function StatCard({ label, value, hint }) {
  return (
    <div className="stat-card">
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value">{value}</span>
      {hint ? <span className="stat-card-hint">{hint}</span> : null}
    </div>
  )
}
