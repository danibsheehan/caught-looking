import { useEffect, useState } from 'react'
import { fetchRecordTimeline } from '../../api/client'
import type { RecordPoint, RecordTimelineResponse } from '../../types/api'
import ChartSkeleton from '../skeletons/ChartSkeleton'

type RecordTimelineStripProps = {
  teamId: number | null | undefined
  season: number | null | undefined
}

export default function RecordTimelineStrip({
  teamId,
  season,
}: RecordTimelineStripProps) {
  const [data, setData] = useState<RecordTimelineResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (teamId == null || season == null) return
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
      <p className="muted">Select a team and season to see the result strip.</p>
    )
  }

  if (loading && !data) {
    return <ChartSkeleton height={120} label="Loading game results" />
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

  return (
    <div className="record-timeline-strip-wrap">
      <div className="record-timeline-strip" role="list" aria-label="Game results in order">
        {data.points.map((p) => (
          <StripCell key={`${p.gameIndex}-${p.officialDate}`} point={p} />
        ))}
      </div>
      <p className="muted small record-timeline-strip-legend">
        <span className="record-legend-w">W</span> win ·{' '}
        <span className="record-legend-l">L</span> loss
        {data.points.some((p) => p.result === 'T') ? (
          <>
            {' '}
            · <span className="record-legend-t">T</span> tie
          </>
        ) : null}
        · hover for date
      </p>
    </div>
  )
}

function StripCell({ point }: { point: RecordPoint }) {
  const cls =
    point.result === 'W'
      ? 'is-win'
      : point.result === 'L'
        ? 'is-loss'
        : 'is-tie'
  const title = `Game ${point.gameIndex} · ${point.officialDate} · ${point.result} (${point.wins}-${point.losses})`
  return (
    <span role="listitem" className={`record-timeline-cell ${cls}`} title={title}>
      {point.result}
    </span>
  )
}
