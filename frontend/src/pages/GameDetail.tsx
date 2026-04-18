import { startTransition, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { GameScoreBar } from '../components/charts'
import GameBoxscorePanel from '../components/game/GameBoxscorePanel'
import { fetchGameBoxscore } from '../api/client'
import type { GameBoxscoreResponse } from '../types/api'

export default function GameDetail() {
  const { gamePk: gamePkParam } = useParams()
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date')

  const gamePk = useMemo(() => {
    const n = Number(gamePkParam)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [gamePkParam])

  const [box, setBox] = useState<GameBoxscoreResponse | null>(null)
  const [boxError, setBoxError] = useState<Error | null>(null)
  const [boxLoading, setBoxLoading] = useState(true)

  useEffect(() => {
    if (gamePk == null) return
    let cancelled = false
    startTransition(() => {
      setBoxLoading(true)
      setBoxError(null)
      setBox(null)
    })
    fetchGameBoxscore(gamePk)
      .then((data) => {
        if (!cancelled) setBox(data)
      })
      .catch((e) => {
        if (!cancelled)
          setBoxError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setBoxLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gamePk])

  const backTo = useMemo(() => {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return `/games?date=${encodeURIComponent(date)}`
    }
    return '/games'
  }, [date])

  if (gamePk == null) {
    return <Navigate to="/games" replace />
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="muted small" style={{ marginBottom: '0.35rem' }}>
            <Link className="game-detail-back" to={backTo}>
              ← Games
              {date ? ` · ${date}` : ''}
            </Link>
          </p>
          <h1>Box score</h1>
          <p className="muted">
            Team totals, pitching and batting lines, and runs by inning.
          </p>
        </div>
      </header>

      {boxLoading ? (
        <p className="muted">Loading box score…</p>
      ) : boxError ? (
        <p className="error" role="alert">
          {boxError.message}
        </p>
      ) : box ? (
        <GameBoxscorePanel data={box} />
      ) : null}

      <div className="panel chart-panel">
        <h2>Runs by inning</h2>
        <p className="muted small">
          Stacked bars use each team&apos;s primary color per inning.
        </p>
        <GameScoreBar key={String(gamePk)} gamePk={gamePk} />
      </div>
    </section>
  )
}
