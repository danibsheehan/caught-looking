import type { StatcastChartTooltipRow } from '../../utils/statcastDisplay';

type StatcastMetricTooltipContentProps = {
  rows: StatcastChartTooltipRow[];
};

/**
 * Shared layout: title, then Distance → Velocity → Angle → Result as an unordered list
 * (see `buildSprayTooltipRows` / `buildScatterTooltipRows`).
 */
export default function StatcastMetricTooltipContent({ rows }: StatcastMetricTooltipContentProps) {
  const titleRow = rows.find(
    (r): r is Extract<StatcastChartTooltipRow, { variant: 'title' }> => r.variant === 'title',
  );
  const metricRows = rows.filter(
    (r): r is Extract<StatcastChartTooltipRow, { variant: 'step' }> => r.variant === 'step',
  );

  return (
    <>
      {titleRow ? <div className="statcast-metric-tooltip__title">{titleRow.text}</div> : null}
      {metricRows.length > 0 ? (
        <ul className="statcast-metric-tooltip__list">
          {metricRows.map((row) => (
            <li key={row.step} className="statcast-metric-tooltip__item">
              <span className="statcast-metric-tooltip__label">{row.title}</span>
              <span className="statcast-metric-tooltip__value">{row.body}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
