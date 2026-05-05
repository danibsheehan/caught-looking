type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

/** Compact label + metric for dashboards. */
export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
      {hint ? <span className="stat-card__hint">{hint}</span> : null}
    </div>
  );
}
