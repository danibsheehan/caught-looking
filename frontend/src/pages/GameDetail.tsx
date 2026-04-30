import { useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { GameStatcastScatter, GameStatcastSpray } from '../components/charts'
import GameBoxscorePanel from '../components/game/GameBoxscorePanel'
import { fetchGameBoxscore, fetchGameStatcast, fetchGameStatcastPitches } from '../api/client'
import { useAsyncResource } from '../hooks/useAsyncResource'
import type {
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  GameStatcastResponse,
} from '../types/api.compat'

export default function GameDetail() {
  const { gamePk: gamePkParam } = useParams()
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date')

  const gamePk = useMemo(() => {
    const n = Number(gamePkParam)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [gamePkParam])

  const pkReady = gamePk != null

  const {
    data: box,
    error: boxError,
    loading: boxLoading,
  } = useAsyncResource<GameBoxscoreResponse>(
    {
      enabled: pkReady,
      initialPending: true,
      clearDataBeforeFetch: true,
      fetch: () => {
        if (gamePk == null) throw new Error('GameDetail: gamePk required')
        return fetchGameBoxscore(gamePk)
      },
    },
    [gamePk],
  )

  const {
    data: statcast,
    error: statcastError,
    loading: statcastLoading,
  } = useAsyncResource<GameStatcastResponse>(
    {
      enabled: pkReady,
      initialPending: true,
      clearDataBeforeFetch: true,
      fetch: () => {
        if (gamePk == null) throw new Error('GameDetail: gamePk required')
        return fetchGameStatcast(gamePk)
      },
    },
    [gamePk],
  )

  const {
    data: pitchesData,
    error: pitchesError,
    loading: pitchesLoading,
  } = useAsyncResource<GameStatcastPitchesResponse>(
    {
      enabled: pkReady,
      initialPending: true,
      clearDataBeforeFetch: true,
      fetch: () => {
        if (gamePk == null) throw new Error('GameDetail: gamePk required')
        return fetchGameStatcastPitches(gamePk)
      },
    },
    [gamePk],
  )

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
          The field view shows roughly where each ball was put in play. The scatter chart uses the
          same batted balls for exit velocity and launch angle. Team colors for away vs home batting
          match the runs-by-inning chart (circles vs diamonds repeat the away/home split).
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
            <h3 className="game-statcast__subhead">How each batted ball was struck</h3>
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
