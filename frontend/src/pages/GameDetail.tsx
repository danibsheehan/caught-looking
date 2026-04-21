import { startTransition, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { GameStatcastScatter, GameStatcastSpray } from '../components/charts'
import GameBoxscorePanel from '../components/game/GameBoxscorePanel'
import { fetchGameBoxscore, fetchGameStatcast, fetchGameStatcastPitches } from '../api/client'
import type {
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  GameStatcastResponse,
} from '../types/api'

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

  const [statcast, setStatcast] = useState<GameStatcastResponse | null>(null)
  const [statcastError, setStatcastError] = useState<Error | null>(null)
  const [statcastLoading, setStatcastLoading] = useState(true)

  const [pitchesData, setPitchesData] = useState<GameStatcastPitchesResponse | null>(null)
  const [pitchesError, setPitchesError] = useState<Error | null>(null)
  const [pitchesLoading, setPitchesLoading] = useState(true)

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

  useEffect(() => {
    if (gamePk == null) return
    let cancelled = false
    startTransition(() => {
      setStatcastLoading(true)
      setStatcastError(null)
      setStatcast(null)
    })
    fetchGameStatcast(gamePk)
      .then((data) => {
        if (!cancelled) setStatcast(data)
      })
      .catch((e) => {
        if (!cancelled)
          setStatcastError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setStatcastLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gamePk])

  useEffect(() => {
    if (gamePk == null) return
    let cancelled = false
    startTransition(() => {
      setPitchesLoading(true)
      setPitchesError(null)
      setPitchesData(null)
    })
    fetchGameStatcastPitches(gamePk)
      .then((data) => {
        if (!cancelled) setPitchesData(data)
      })
      .catch((e) => {
        if (!cancelled)
          setPitchesError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setPitchesLoading(false)
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
            <Link className="games-detail__back" to={backTo}>
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
        <GameBoxscorePanel
          data={box}
          gamePk={gamePk}
          pitchLocation={{
            loading: pitchesLoading,
            error: pitchesError,
            data: pitchesData,
          }}
        />
      ) : null}

      <div className="panel chart-panel game-statcast">
        <h2>Batted balls</h2>
        <p className="muted small">
          Spray chart uses hit coordinates in the field (hc_x / hc_y); launch metrics below use exit
          velocity and launch angle.
        </p>
        {statcastLoading ? (
          <p className="muted">Loading batted-ball data…</p>
        ) : statcastError ? (
          <p className="error" role="alert">
            {statcastError.message}
          </p>
        ) : statcast ? (
          <>
            <h3 className="game-statcast__subhead">Spray (field view)</h3>
            <GameStatcastSpray
              battedBalls={statcast.battedBalls}
              venueId={statcast.venueId}
              venueName={statcast.venueName}
              awayTeamId={box?.away.teamId}
              homeTeamId={box?.home.teamId}
            />
            <h3 className="game-statcast__subhead">Exit velocity vs. launch angle</h3>
            <GameStatcastScatter
              battedBalls={statcast.battedBalls}
              awayTeamId={box?.away.teamId}
              homeTeamId={box?.home.teamId}
            />
          </>
        ) : null}
      </div>
    </section>
  )
}
