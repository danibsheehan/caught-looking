import { useMemo } from 'react'
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { distinctChartColorsForTeamIds } from '../../utils/mlbTeamColors'

export type TeamWinRow = { abbrev: string; wins: number; teamId: number }

type TeamWinsBarChartProps = {
  data: TeamWinRow[]
  height?: number
}

/** Vertical bar chart: wins by team abbreviation (standings slice). */
export default function TeamWinsBarChart({
  data,
  height = 320,
}: TeamWinsBarChartProps) {
  const surfaceHex = useChartSurfaceHex()
  const barColors = useMemo(
    () => distinctChartColorsForTeamIds(data.map((r) => r.teamId), surfaceHex),
    [data, surfaceHex],
  )

  return (
    <div className="chart-frame" style={{ width: '100%', minHeight: height }}>
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
          <Bar dataKey="wins" radius={[4, 4, 0, 0]} name="Wins">
            {data.map((row, i) => (
              <Cell key={row.teamId} fill={barColors[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
