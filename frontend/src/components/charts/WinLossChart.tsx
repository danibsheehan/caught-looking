import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchRecordTimeline } from '../../api/client'
import type { RecordTimelineResponse } from '../../types/api'
import ChartSkeleton from '../skeletons/ChartSkeleton'

type WinLossChartProps = {
  teamId: number | null | undefined
  season: number | null | undefined
}

export default function WinLossChart({ teamId, season }: WinLossChartProps) {
  const [data, setData] = useState<RecordTimelineResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (teamId == null || season == null) {
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      fetchRecordTimeline(teamId, { season })
        .then((d) => {
          if (!cancelled) setData(d)
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
  }, [teamId, season])

  if (teamId == null || season == null) {
    return (
      <p className="muted">Select a team and season to plot rolling win percentage.</p>
    )
  }

  if (loading && !data) {
    return <ChartSkeleton height={360} label="Loading win percentage timeline" />
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    )
  }

  if (!data?.points?.length) {
    return <p className="muted">No completed games in this sample yet.</p>
  }

  const rows = data.points.map((p) => ({
    ...p,
    pctLabel: `${(p.pct * 100).toFixed(1)}%`,
    pctPct: p.pct * 100,
    x: p.gameIndex,
  }))

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={rows} margin={{ top: 10, right: 10, left: 4, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="x"
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
          formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Win %']}
          labelFormatter={(_, p) => {
            const row = p?.[0]?.payload as
              | { gameIndex: number; officialDate: string; result: string; wins: number; losses: number }
              | undefined
            if (!row) return ''
            return `Game ${row.gameIndex} · ${row.officialDate} (${row.result}) · ${row.wins}-${row.losses}`
          }}
          contentStyle={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-h)',
          }}
        />
        <Line
          type="monotone"
          dataKey="pctPct"
          name="Win %"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={{ r: 2, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
