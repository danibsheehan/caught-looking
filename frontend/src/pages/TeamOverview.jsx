import { useMemo, useState } from 'react'
import { WinLossChart } from '../components/charts'
import TeamPageSkeleton from '../components/skeletons/TeamPageSkeleton.jsx'
import { PlayerCard, TeamSelector } from '../components/ui'
import { useTeams } from '../hooks/useMLB.js'

const DEFAULT_SEASON = 2026

export default function TeamOverview() {
  const { data, loading, error } = useTeams({ sportId: '1' })
  const teams = useMemo(() => data?.teams ?? [], [data])
  const [teamId, setTeamId] = useState(/** @type {number | ''} */ (''))
  const [season, setSeason] = useState(DEFAULT_SEASON)

  const selected = useMemo(() => {
    if (teamId === '') return null
    return teams.find((t) => t.id === teamId) ?? null
  }, [teams, teamId])

  if (loading && !data) {
    return <TeamPageSkeleton />
  }

  if (error) {
    return (
      <section className="page">
        <h1>Teams</h1>
        <p className="error" role="alert">
          {error.message}
        </p>
      </section>
    )
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Teams</h1>
          <p className="muted">
            MLB clubs from the API — use this shell for roster and team charts
            next.
          </p>
        </div>
        <div className="page-controls">
          <TeamSelector
            id="team-overview-selector"
            label="Club"
            teams={teams}
            value={teamId}
            onChange={setTeamId}
            placeholder="Select a team"
          />
          <label className="field">
            <span className="field-label">Season (timeline)</span>
            <input
              className="field-input"
              type="number"
              min={1900}
              max={2100}
              value={season}
              onChange={(e) => setSeason(Number(e.target.value) || DEFAULT_SEASON)}
            />
          </label>
        </div>
      </header>

      {selected ? (
        <>
          <PlayerCard
            title={`${selected.abbreviation} — ${selected.teamName}`}
            subtitle={`${selected.leagueName} · ${selected.divisionName}`}
          >
            <dl className="meta-dl">
              <div>
                <dt>Full name</dt>
                <dd>{selected.name}</dd>
              </div>
              <div>
                <dt>Active</dt>
                <dd>{selected.active ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </PlayerCard>
          <div className="panel chart-panel">
            <h2>Season win % (cumulative)</h2>
            <p className="muted small">
              Built from the club schedule; each point is after a completed game.
            </p>
            <WinLossChart
              key={`${selected.id}-${season}`}
              teamId={selected.id}
              season={season}
            />
          </div>
        </>
      ) : (
        <p className="muted">Choose a team to preview the card and win% chart.</p>
      )}
    </section>
  )
}
