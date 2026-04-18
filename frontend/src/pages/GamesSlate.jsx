import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import GameListSkeleton from '../components/skeletons/GameListSkeleton.jsx'
import { TeamSelector } from '../components/ui'
import { fetchGamesForDate } from '../api/client.js'
import { useTeams } from '../hooks/useMLB.js'

/** @returns {string} */
function localISODate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const isoDateRe = /^\d{4}-\d{2}-\d{2}$/

/**
 * @param {URLSearchParams} searchParams
 * @returns {string}
 */
function dateFromSearchParams(searchParams) {
  const q = searchParams.get('date')
  if (q && isoDateRe.test(q)) return q
  return localISODate()
}

export default function GamesSlate() {
  const [searchParams, setSearchParams] = useSearchParams()
  const date = useMemo(
    () => dateFromSearchParams(searchParams),
    [searchParams],
  )

  const { data: teamsData } = useTeams({ sportId: '1' })
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData])

  const [teamId, setTeamId] = useState(/** @type {number | ''} */ (''))
  const [games, setGames] = useState(
    /** @type {import('../types/api').GameSummary[]} */ ([]),
  )
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null))
  const [loadingList, setLoadingList] = useState(false)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      setLoadingList(true)
      setLoadError(null)
      fetchGamesForDate({
        date,
        teamId:
          teamId === '' || teamId === undefined
            ? undefined
            : Number(teamId),
      })
        .then((res) => {
          if (cancelled) return
          setGames(res.games ?? [])
        })
        .catch((e) => {
          if (!cancelled)
            setLoadError(e instanceof Error ? e.message : String(e))
        })
        .finally(() => {
          if (!cancelled) setLoadingList(false)
        })
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [date, teamId])

  /** @param {string} next */
  function onDateChange(next) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('date', next)
        return p
      },
      { replace: true },
    )
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Games</h1>
          <p className="muted">
            Pick a date (and optionally a team), then open a game for runs by inning
            and the full timeline.
          </p>
        </div>
        <div className="page-controls">
          <label className="field">
            <span className="field-label">Date</span>
            <input
              className="field-input"
              style={{ width: '11rem' }}
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </label>
          {teams.length > 0 ? (
            <TeamSelector
              id="game-day-team"
              label="Team (optional)"
              teams={teams}
              value={teamId}
              onChange={setTeamId}
              placeholder="All teams"
            />
          ) : null}
        </div>
      </header>

      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="panel">
        <h2>Games on this day</h2>
        {loadingList ? (
          <GameListSkeleton rows={7} />
        ) : games.length === 0 ? (
          <p className="muted">
            No games on this date (try another day or clear the team filter).
          </p>
        ) : (
          <ul className="game-day-list" role="list">
            {games.map((g) => {
              const score =
                g.status === 'Final' || g.status === 'Game Over'
                  ? `${g.awayScore}–${g.homeScore}`
                  : '—'
              const to = `/games/${g.gamePk}?date=${encodeURIComponent(date)}`
              return (
                <li key={g.gamePk} role="none">
                  <Link className="game-day-row" to={to}>
                    <span className="game-day-matchup">
                      {g.awayTeam} @ {g.homeTeam}
                    </span>
                    <span className="game-day-meta muted small">
                      {score} · {g.status}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
