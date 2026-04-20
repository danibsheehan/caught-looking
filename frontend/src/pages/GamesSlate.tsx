import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import GameListSkeleton from '../components/skeletons/GameListSkeleton'
import { TeamSelector } from '../components/ui'
import { fetchGamesForDate } from '../api/client'
import { useTeams } from '../hooks/useMLB'
import type { GameSummary } from '../types/api'

function localISODate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const isoDateRe = /^\d{4}-\d{2}-\d{2}$/

function dateFromSearchParams(searchParams: URLSearchParams): string {
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

  const [teamId, setTeamId] = useState<number | ''>('')
  const [games, setGames] = useState<GameSummary[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
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

  function onDateChange(next: string) {
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
          <label className="form-field">
            <span className="form-field__label">Date</span>
            <input
              className="form-field__input form-field__input--date"
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </label>
          {teams.length > 0 ? (
            <TeamSelector
              id="games-slate-team"
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

      <div className="panel games-slate">
        <h2>Games on this day</h2>
        {loadingList ? (
          <GameListSkeleton rows={7} />
        ) : games.length === 0 ? (
          <p className="muted">
            No games on this date (try another day or clear the team filter).
          </p>
        ) : (
          <ul className="games-slate__list" role="list">
            {games.map((g) => {
              const score =
                g.status === 'Final' || g.status === 'Game Over'
                  ? `${g.awayScore}–${g.homeScore}`
                  : '—'
              const to = `/games/${g.gamePk}?date=${encodeURIComponent(date)}`
              return (
                <li key={g.gamePk} role="none">
                  <Link className="games-slate__link" to={to}>
                    <span className="games-slate__matchup">
                      {g.awayTeam} @ {g.homeTeam}
                    </span>
                    <span className="games-slate__meta muted small">
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
