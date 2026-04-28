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
import type { GameTimelineResponse } from '../../types/api.compat'
import ChartSkeleton from '../skeletons/ChartSkeleton'
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex'
import { gameInningBarFills } from '../../utils/gameChartColors'
import { chartCartesianTick } from '../../utils/rechartsAxis'

type GameScoreBarProps = {
  gamePk: number | string | null | undefined
  /** When false, omits the one-line away @ home · final caption (e.g. when a score strip is above). */
  showCaption?: boolean
}

export default function GameScoreBar({
  gamePk,
  showCaption = true,
}: GameScoreBarProps) {
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

  const { awayFill, homeFill } = useMemo(
    () => gameInningBarFills(data?.awayId, data?.homeId, surfaceHex),
    [data?.awayId, data?.homeId, surfaceHex],
  )

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
      {showCaption ? (
        <p className="muted small" style={{ marginBottom: '0.5rem' }}>
          {awayKey} @ {homeKey} · final {data.awayTotal}–{data.homeTotal}
        </p>
      ) : null}
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 4, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid-faint)" />
          <XAxis
            dataKey="inning"
            tick={chartCartesianTick}
            label={{
              value: 'Inning',
              position: 'insideBottom',
              offset: -2,
              fill: 'var(--muted)',
              fontFamily: 'var(--sans)',
            }}
          />
          <YAxis allowDecimals={false} tick={chartCartesianTick} width={36} />
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
