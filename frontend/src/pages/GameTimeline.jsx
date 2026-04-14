import { useEffect, useMemo, useState } from 'react'
import { GameScoreBar } from '../components/charts'
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

export default function GameTimeline() {
  const { data: teamsData } = useTeams({ sportId: '1' })
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData])

  const [date, setDate] = useState(localISODate)
  const [teamId, setTeamId] = useState(/** @type {number | ''} */ (''))
  const [games, setGames] = useState(
    /** @type {import('../types/api').GameSummary[]} */ ([]),
  )
  const [selectedPk, setSelectedPk] = useState(
    /** @type {number | null} */ (null),
  )
  const [loadError, setLoadError] = useState(
    /** @type {string | null} */ (null),
  )
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
          const list = res.games ?? []
          setGames(list)
          setSelectedPk(list.length ? list[0].gamePk : null)
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

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Game timeline</h1>
          <p className="muted">
            Pick a <strong>date</strong> (and optionally a team), choose a game from
            the list, then see runs by inning.
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
              onChange={(e) => setDate(e.target.value)}
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
          <p className="muted">No games on this date (try another day or clear the team filter).</p>
        ) : (
          <ul className="game-day-list" role="list">
            {games.map((g) => {
              const active = selectedPk === g.gamePk
              const score =
                g.status === 'Final' || g.status === 'Game Over'
                  ? `${g.awayScore}–${g.homeScore}`
                  : '—'
              return (
                <li key={g.gamePk} role="none">
                  <button
                    type="button"
                    className={active ? 'game-day-row is-active' : 'game-day-row'}
                    onClick={() => setSelectedPk(g.gamePk)}
                  >
                    <span className="game-day-matchup">
                      {g.awayTeam} @ {g.homeTeam}
                    </span>
                    <span className="game-day-meta muted small">
                      {score} · {g.status}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selectedPk != null ? (
        <div className="panel chart-panel">
          <h2>Runs by inning</h2>
          <p className="muted small">
            Stacked bars: away (blue) + home (accent) per inning.
          </p>
          <GameScoreBar key={String(selectedPk)} gamePk={selectedPk} />
        </div>
      ) : null}

      <details className="muted small" style={{ marginTop: '1rem' }}>
        <summary>Advanced: open by numeric game ID</summary>
        <p style={{ marginTop: '0.5rem' }}>
          MLB calls this <code>gamePk</code>. You normally do not need it — use the
          list above. If you have the id from a link or API, you can paste it in dev
          tools or we can add a direct-id field later.
        </p>
      </details>
    </section>
  )
}
