/**
 * @param {{ height?: number, label?: string }} props
 */
export default function ChartSkeleton({ height = 320, label = 'Loading chart' }) {
  return (
    <div
      className="chart-skeleton chart-skeleton--inline"
      style={{ minHeight: height }}
      role="status"
      aria-busy="true"
      aria-label={label}
    />
  )
}
