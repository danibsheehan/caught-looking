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
import { fetchRecordTimelinesBatch } from '../../api/client.js'
import ChartSkeleton from '../skeletons/ChartSkeleton.jsx'

/** Distinct strokes for up to 8 teams (matches backend batch cap). */
const SERIES_STROKES = [
  'var(--accent)',
  '#22c55e',
  '#38bdf8',
  '#f97316',
  '#eab308',
  '#ec4899',
  '#94a3b8',
  '#a78bfa',
]

/**
 * @param {{
 *   teamIds: number[]
 *   season: number | null | undefined
 *   getLabel: (teamId: number) => string
 * }} props
 */
export default function MultiTeamWinPctChart({ teamIds, season, getLabel }) {
  const [payload, setPayload] = useState(
    /** @type {import('../../types/api').RecordTimelinesBatchResponse | null} */ (
      null
    ),
  )
  const [error, setError] = useState(/** @type {Error | null} */ (null))
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

  const chartData = useMemo(() => {
    if (!payload?.timelines?.length) return []
    let maxGames = 0
    for (const tl of payload.timelines) {
      maxGames = Math.max(maxGames, tl.points?.length ?? 0)
    }
    const rows = []
    for (let i = 1; i <= maxGames; i++) {
      /** @type {Record<string, number | undefined>} */
      const row = { gameIndex: i }
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
        {sortedIds.map((id, idx) => (
          <Line
            key={id}
            type="monotone"
            dataKey={`pct_${id}`}
            name={getLabel(id)}
            stroke={SERIES_STROKES[idx % SERIES_STROKES.length]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
