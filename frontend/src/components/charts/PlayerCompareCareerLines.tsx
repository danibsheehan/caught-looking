import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipValueType,
} from 'recharts'
import type { PlayersYearByYearResponse } from '../../types/api'
import { usePlayerCompareChartColors } from '../../hooks/usePlayerCompareChartColors'
import {
  formatYearByYearAxisValue,
  formatYearByYearTooltipValue,
  yearByYearMetricShortLabel,
} from '../../utils/yearByYearMetric'

type Row = {
  season: number
  a: number | null
  b: number | null
  league: number | null
}

function buildRows(payload: PlayersYearByYearResponse | null): Row[] {
  if (!payload?.players?.length) return []
  const [p1, p2] = payload.players
  const seasons = new Set<number>()
  for (const pt of p1.points ?? []) seasons.add(pt.season)
  for (const pt of p2.points ?? []) seasons.add(pt.season)
  const sorted = [...seasons].sort((x, y) => x - y)
  return sorted.map((season) => ({
    season,
    a: p1.points?.find((x) => x.season === season)?.value ?? null,
    b: p2.points?.find((x) => x.season === season)?.value ?? null,
    league: payload.leagueBySeason[String(season)] ?? null,
  }))
}


type Props = {
  data: PlayersYearByYearResponse
  teamId1?: number | null
  teamId2?: number | null
}

export default function PlayerCompareCareerLines({
  data,
  teamId1,
  teamId2,
}: Props) {
  const rows = useMemo(() => buildRows(data), [data])
  const { colorA, colorB } = usePlayerCompareChartColors(teamId1, teamId2)
  const [pa, pb] = data.players
  const nameA = pa?.fullName ?? 'Player 1'
  const nameB = pb?.fullName ?? 'Player 2'
  const metric = data.metric
  const axisTitle = yearByYearMetricShortLabel(metric)
  const leagueColor = 'var(--muted)'

  if (!rows.length) {
    return <p className="muted">No year-by-year data for this comparison.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="season"
          tick={{ fill: 'var(--text)', fontSize: 11 }}
          tickFormatter={(s) => String(s)}
        />
        <YAxis
          tick={{ fill: 'var(--text)', fontSize: 11 }}
          domain={['auto', 'auto']}
          tickFormatter={(v) => formatYearByYearAxisValue(metric, Number(v))}
          label={{
            value: axisTitle,
            angle: -90,
            position: 'insideLeft',
            fill: 'var(--muted)',
            fontSize: 11,
          }}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-h)',
          }}
          formatter={(
            value: TooltipValueType | undefined,
            name: string | number | undefined,
          ) => [
            formatYearByYearTooltipValue(
              metric,
              typeof value === 'number' ? value : null,
            ),
            String(name ?? ''),
          ]}
          labelFormatter={(s) => `Season ${s}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="league"
          name="MLB avg (teams)"
          stroke={leagueColor}
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="a"
          name={nameA}
          stroke={colorA}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="b"
          name={nameB}
          stroke={colorB}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
