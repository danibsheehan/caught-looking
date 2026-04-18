import { useEffect, useMemo, useState } from 'react'
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { fetchPlayersCompare } from '../../api/client'
import type { PlayersRadarResponse } from '../../types/api'
import ChartSkeleton from '../skeletons/ChartSkeleton'

type RadarAxis = { key: string; label: string; higherIsBetter: boolean }

const HITTING_AXES: RadarAxis[] = [
  { key: 'avg', label: 'AVG', higherIsBetter: true },
  { key: 'obp', label: 'OBP', higherIsBetter: true },
  { key: 'slg', label: 'SLG', higherIsBetter: true },
  { key: 'hr', label: 'HR', higherIsBetter: true },
  { key: 'rbi', label: 'RBI', higherIsBetter: true },
]

const PITCHING_AXES: RadarAxis[] = [
  { key: 'era', label: 'ERA', higherIsBetter: false },
  { key: 'whip', label: 'WHIP', higherIsBetter: false },
  { key: 'k9', label: 'K/9', higherIsBetter: true },
  { key: 'bb9', label: 'BB/9', higherIsBetter: false },
]

function pairScores(
  v1: number,
  v2: number,
  higherIsBetter: boolean,
): [number, number] {
  const a = Number.isFinite(v1) ? v1 : 0
  const b = Number.isFinite(v2) ? v2 : 0
  if (higherIsBetter) {
    const m = Math.max(a, b, 1e-6)
    return [(a / m) * 100, (b / m) * 100]
  }
  const m = Math.max(a, b, 1e-6)
  return [((m - a) / m) * 100, ((m - b) / m) * 100]
}

function toRadarRows(
  payload: PlayersRadarResponse | null,
  group: 'hitting' | 'pitching',
): { metric: string; a: number; b: number }[] {
  if (!payload?.players || payload.players.length < 2) return []
  const axes = group === 'pitching' ? PITCHING_AXES : HITTING_AXES
  const [p1, p2] = payload.players
  const s1 = p1.stats ?? {}
  const s2 = p2.stats ?? {}
  return axes.map((ax) => {
    const v1 = s1[ax.key] ?? 0
    const v2 = s2[ax.key] ?? 0
    const [a, b] = pairScores(v1, v2, ax.higherIsBetter)
    return {
      metric: ax.label,
      a,
      b,
    }
  })
}

type PlayerRadarProps = {
  playerId1: number | null | undefined
  playerId2: number | null | undefined
  season: number | null | undefined
  group?: 'hitting' | 'pitching'
}

export default function PlayerRadar({
  playerId1,
  playerId2,
  season,
  group = 'hitting',
}: PlayerRadarProps) {
  const [data, setData] = useState<PlayersRadarResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (
      playerId1 == null ||
      playerId2 == null ||
      season == null ||
      playerId1 === playerId2
    ) {
      return
    }
    let cancelled = false
    const ids = `${playerId1},${playerId2}`
    const t = setTimeout(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      fetchPlayersCompare({ ids, season, group })
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
  }, [playerId1, playerId2, season, group])

  const rows = useMemo(() => toRadarRows(data, group), [data, group])

  const nameA = data?.players?.[0]?.fullName ?? 'Player A'
  const nameB = data?.players?.[1]?.fullName ?? 'Player B'

  if (
    playerId1 == null ||
    playerId2 == null ||
    season == null ||
    playerId1 === playerId2
  ) {
    return (
      <p className="muted">
        Enter two different MLB player IDs and a season to compare.
      </p>
    )
  }

  if (loading && !data) {
    return <ChartSkeleton height={420} label="Loading player comparison" />
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    )
  }

  if (!rows.length) {
    return <p className="muted">Not enough stat rows for a radar (empty season?).</p>
  }

  return (
    <ResponsiveContainer width="100%" height={420}>
      <RadarChart
        data={rows}
        cx="50%"
        cy="50%"
        outerRadius="72%"
        margin={{ top: 16, right: 24, bottom: 16, left: 24 }}
      >
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text)', fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name={nameA}
          dataKey="a"
          stroke="var(--accent)"
          fill="var(--accent)"
          fillOpacity={0.35}
          isAnimationActive={false}
        />
        <Radar
          name={nameB}
          dataKey="b"
          stroke="#38bdf8"
          fill="#38bdf8"
          fillOpacity={0.22}
          isAnimationActive={false}
        />
        <Legend />
        <Tooltip
          contentStyle={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-h)',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
