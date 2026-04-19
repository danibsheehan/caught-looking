import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchGameTimeline } from '../../api/client'
import type { GameTimelineResponse } from '../../types/api'
import ChartSkeleton from '../skeletons/ChartSkeleton'
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex'
import { adjustChartColorForSurface } from '../../utils/chartColorContrast'
import {
  CHART_NEUTRAL_FALLBACK,
  CHART_NEUTRAL_FALLBACK_ALT,
  resolveGameScoreBarFills,
} from '../../utils/mlbTeamColors'

type GameScoreBarProps = {
  gamePk: number | string | null | undefined
}

export default function GameScoreBar({ gamePk }: GameScoreBarProps) {
  const surfaceHex = useChartSurfaceHex()
  const [data, setData] = useState<GameTimelineResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const pk =
    gamePk === '' || gamePk == null
      ? null
      : typeof gamePk === 'string'
        ? Number(gamePk)
        : gamePk

  useEffect(() => {
    if (pk == null || !Number.isFinite(pk) || pk <= 0) {
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      fetchGameTimeline(pk)
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
  }, [pk])

  const rows = useMemo(() => {
    if (!data?.innings?.length) return []
    return data.innings.map((inn) => ({
      inning: `${inn.inning}`,
      [data.awayTeam || 'Away']: inn.awayRuns,
      [data.homeTeam || 'Home']: inn.homeRuns,
    }))
  }, [data])

  const awayKey = data?.awayTeam || 'Away'
  const homeKey = data?.homeTeam || 'Home'

  const { awayFill, homeFill } = useMemo(() => {
    const raw = resolveGameScoreBarFills(
      data?.awayId,
      data?.homeId,
      CHART_NEUTRAL_FALLBACK_ALT,
      CHART_NEUTRAL_FALLBACK,
    )
    return {
      awayFill: adjustChartColorForSurface(raw.awayFill, surfaceHex),
      homeFill: adjustChartColorForSurface(raw.homeFill, surfaceHex),
    }
  }, [data?.awayId, data?.homeId, surfaceHex])

  if (pk == null || !Number.isFinite(pk) || pk <= 0) {
    return (
      <p className="muted">
        Enter a valid MLB <code>gamePk</code> to chart runs by inning.
      </p>
    )
  }

  if (loading && !data) {
    return <ChartSkeleton height={360} label="Loading inning scores" />
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    )
  }

  if (!data?.innings?.length) {
    return <p className="muted">No inning rows returned.</p>
  }

  return (
    <div>
      <p className="muted small" style={{ marginBottom: '0.5rem' }}>
        {awayKey} @ {homeKey} · final {data.awayTotal}–{data.homeTotal}
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 4, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="inning"
            tick={{ fill: 'var(--text)' }}
            label={{ value: 'Inning', position: 'insideBottom', offset: -2, fill: 'var(--text)' }}
          />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--text)' }} width={36} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-h)',
            }}
          />
          <Legend />
          <Bar dataKey={awayKey} stackId="runs" fill={awayFill} name={awayKey} isAnimationActive={false} />
          <Bar dataKey={homeKey} stackId="runs" fill={homeFill} name={homeKey} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
