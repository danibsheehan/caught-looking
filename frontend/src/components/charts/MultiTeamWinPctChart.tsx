import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchRecordTimelinesBatch } from '../../api/client'
import type { RecordTimelinesBatchResponse } from '../../types/api'
import ChartSkeleton from '../skeletons/ChartSkeleton'
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex'
import { distinctChartColorsForTeamIds } from '../../utils/mlbTeamColors'

type MultiTeamWinPctChartProps = {
  teamIds: number[]
  season: number | null | undefined
  getLabel: (teamId: number) => string
  /** Draw this club’s line on top with heavier stroke (peer context on /teams). */
  focusTeamId?: number
}

export default function MultiTeamWinPctChart({
  teamIds,
  season,
  getLabel,
  focusTeamId,
}: MultiTeamWinPctChartProps) {
  const surfaceHex = useChartSurfaceHex()
  const [payload, setPayload] = useState<RecordTimelinesBatchResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const sortedIds = useMemo(() => {
    const uniq = [...new Set(teamIds.filter((id) => id > 0))]
    uniq.sort((a, b) => a - b)
    return uniq
  }, [teamIds])

  useEffect(() => {
    if (sortedIds.length === 0 || season == null) {
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      fetchRecordTimelinesBatch({ teamIds: sortedIds, season })
        .then((d) => {
          if (!cancelled) setPayload(d)
        })
        .catch((e) => {
          if (!cancelled)
            setError(e instanceof Error ? e : new Error(String(e)))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [sortedIds, season])

  const lineColors = useMemo(
    () => distinctChartColorsForTeamIds(sortedIds, surfaceHex),
    [sortedIds, surfaceHex],
  )

  const colorByTeamId = useMemo(() => {
    const m = new Map<number, string>()
    sortedIds.forEach((id, idx) => m.set(id, lineColors[idx]))
    return m
  }, [sortedIds, lineColors])

  /** Non-focused lines first so the focused club renders on top. */
  const renderOrder = useMemo(() => {
    if (focusTeamId == null || !sortedIds.includes(focusTeamId)) return sortedIds
    const rest = sortedIds.filter((id) => id !== focusTeamId)
    return [...rest, focusTeamId]
  }, [sortedIds, focusTeamId])

  const chartData = useMemo(() => {
    if (!payload?.timelines?.length) return []
    let maxGames = 0
    for (const tl of payload.timelines) {
      maxGames = Math.max(maxGames, tl.points?.length ?? 0)
    }
    const rows: Array<Record<string, number | undefined> & { gameIndex: number }> = []
    for (let i = 1; i <= maxGames; i++) {
      const row: Record<string, number | undefined> & { gameIndex: number } = {
        gameIndex: i,
      }
      for (const tl of payload.timelines) {
        const pt = tl.points[i - 1]
        const key = `pct_${tl.teamId}`
        if (pt) row[key] = pt.pct * 100
      }
      rows.push(row)
    }
    return rows
  }, [payload])

  if (sortedIds.length === 0 || season == null) {
    return (
      <p className="muted">Select a division with teams to compare win percentage curves.</p>
    )
  }

  if (loading && !payload) {
    return (
      <ChartSkeleton height={360} label="Loading division win % timelines" />
    )
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    )
  }

  if (!chartData.length) {
    return <p className="muted">No completed games in this sample yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 4, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="gameIndex"
          tick={{ fill: 'var(--text)', fontSize: 11 }}
          label={{ value: 'Game #', position: 'insideBottom', offset: -4, fill: 'var(--text)' }}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: 'var(--text)' }}
          width={48}
        />
        <Tooltip
          formatter={(value) =>
            value != null && typeof value === 'number'
              ? [`${value.toFixed(1)}%`, 'Win %']
              : ['—', '']
          }
          labelFormatter={(label) => `Game ${label}`}
          contentStyle={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-h)',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => <span style={{ color: 'var(--text)' }}>{value}</span>}
        />
        {renderOrder.map((id) => {
          const focused = focusTeamId != null && id === focusTeamId
          return (
            <Line
              key={id}
              type="monotone"
              dataKey={`pct_${id}`}
              name={getLabel(id)}
              stroke={colorByTeamId.get(id)}
              strokeWidth={focused ? 3 : 1.75}
              strokeOpacity={focused ? 1 : 0.52}
              dot={false}
              isAnimationActive={false}
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}
