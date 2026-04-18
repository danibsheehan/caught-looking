import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type TeamWinRow = { abbrev: string; wins: number }

type TeamWinsBarChartProps = {
  data: TeamWinRow[]
  height?: number
}

/** Vertical bar chart: wins by team abbreviation (standings slice). */
export default function TeamWinsBarChart({
  data,
  height = 320,
}: TeamWinsBarChartProps) {
  return (
    <div className="chart-wrap" style={{ width: '100%', minHeight: height }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 4, bottom: 28 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="abbrev" tick={{ fill: 'var(--text)' }} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--text)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-h)',
            }}
          />
          <Bar
            dataKey="wins"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
            name="Wins"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
