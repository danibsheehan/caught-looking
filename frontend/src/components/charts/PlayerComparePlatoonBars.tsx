import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipValueType,
} from 'recharts'
import type { PlayersPlatoonResponse } from '../../types/api'
import { usePlayerCompareChartColors } from '../../hooks/usePlayerCompareChartColors'
import { chartCartesianTick } from '../../utils/rechartsAxis'
import { buildPlatoonBarData } from '../../utils/playerPlatoonBarRows'

type Props = {
  data: PlayersPlatoonResponse
  teamId1?: number | null
  teamId2?: number | null
}

function formatOps(v: number) {
  return v.toFixed(3)
}

export default function PlayerComparePlatoonBars({
  data,
  teamId1,
  teamId2,
}: Props) {
  const { colorA, colorB } = usePlayerCompareChartColors(teamId1, teamId2)
  const [p1, p2] = data.players
  const rows = useMemo(
    () => buildPlatoonBarData(p1, p2),
    [p1, p2],
  )

  if (rows.length === 0) {
    return (
      <p className="muted">
        No platoon splits for this season (or MLB did not return vl/vr rows).
      </p>
    )
  }

  const n1 = p1?.fullName ?? 'Player 1'
  const n2 = p2?.fullName ?? 'Player 2'
  const pitchNote =
    data.group === 'pitching'
      ? 'Bars are opponent OPS (lower is better for the pitcher).'
      : null

  return (
    <div className="players-compare-platoon">
      {pitchNote ? <p className="players-compare-platoon__note muted small">{pitchNote}</p> : null}
      <div className="players-compare-platoon__chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={rows}
            margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="bucket" tick={{ ...chartCartesianTick, fontSize: 11 }} />
            <YAxis tick={{ ...chartCartesianTick, fontSize: 10 }} width={44} domain={[0, 'auto']} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                fontSize: 11,
              }}
              formatter={(
                value: TooltipValueType | undefined,
                name: string | number | undefined,
              ) => {
                const v =
                  typeof value === 'number' && Number.isFinite(value) ? value : 0
                return [formatOps(v), String(name ?? '')]
              }}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as
                  | {
                      bucket?: string
                      sample1?: number
                      sample2?: number
                    }
                  | undefined
                if (!row?.bucket) return ''
                const s1 = row.sample1 != null && row.sample1 > 0 ? `n=${row.sample1}` : ''
                const s2 = row.sample2 != null && row.sample2 > 0 ? `n=${row.sample2}` : ''
                const bits = [s1, s2].filter(Boolean)
                return bits.length ? `${row.bucket} · ${bits.join(' · ')}` : row.bucket
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="opsPlayer1"
              name={n1}
              fill={colorA}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
            />
            <Bar
              dataKey="opsPlayer2"
              name={n2}
              fill={colorB}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
