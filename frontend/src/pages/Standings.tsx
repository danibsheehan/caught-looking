import { useMemo, useState } from 'react'
import { MultiTeamWinPctChart, TeamWinsBarChart } from '../components/charts'
import { StatCard, TeamSelector } from '../components/ui'
import { useStandings, useTeams } from '../hooks/useMLB'
import StandingsPageSkeleton from '../components/skeletons/StandingsPageSkeleton'
import {
  divisionIndexForTeam,
  sortStandingTeams,
  teamLabelMap,
} from '../utils/standings'

export default function Standings() {
  const { data: teamsData } = useTeams({ sportId: '1' })
  const { data, error, loading } = useStandings({})

  const abbrevById = useMemo(() => teamLabelMap(teamsData), [teamsData])

  const divisions = data?.divisions ?? []
  const teams = teamsData?.teams ?? []
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [focusTeamId, setFocusTeamId] = useState<number | ''>('')

  const safeIdx = Math.min(
    Math.max(0, selectedIdx),
    Math.max(0, divisions.length - 1),
  )
  const selected = divisions[safeIdx]

  const chartRows = useMemo(() => {
    if (!selected?.teams?.length) return []
    return sortStandingTeams(selected.teams).map((t) => ({
      abbrev: abbrevById.get(t.teamId) ?? t.teamName,
      wins: t.wins,
    }))
  }, [selected, abbrevById])

  const divisionTeamIds = useMemo(
    () => (selected?.teams ?? []).map((t) => t.teamId),
    [selected],
  )

  function onTeamSelected(id: number | '') {
    setFocusTeamId(id)
    if (id === '') return
    const idx = divisionIndexForTeam(divisions, id)
    if (idx >= 0) setSelectedIdx(idx)
  }

  if (loading && !data) {
    return <StandingsPageSkeleton />
  }

  if (error) {
    return (
      <section className="page">
        <h1>Standings</h1>
        <p className="error" role="alert">
          {error.message}
        </p>
        <p className="muted">
          Is the Go API running? With the default Vite proxy, start the backend on
          port 8080, or set <code>VITE_API_BASE</code> to your API origin.
        </p>
      </section>
    )
  }

  const teamsInDivision = selected?.teams?.length ?? 0

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Standings</h1>
          <p className="muted">
            Season <strong>{data?.season ?? '—'}</strong> · regular season · AL /
            NL
          </p>
          <div className="stat-cards" role="list">
            <div role="listitem">
              <StatCard label="Season" value={data?.season ?? '—'} />
            </div>
            <div role="listitem">
              <StatCard label="Divisions" value={divisions.length} />
            </div>
            <div role="listitem">
              <StatCard
                label="Teams (chart)"
                value={teamsInDivision}
                hint="Selected division"
              />
            </div>
          </div>
        </div>
        <div className="page-controls">
          {teams.length > 0 && (
            <TeamSelector
              id="standings-team-focus"
              label="Jump to team"
              teams={teams}
              value={focusTeamId}
              onChange={onTeamSelected}
              placeholder="All teams"
            />
          )}
          {divisions.length > 0 && (
            <label className="field">
              <span className="field-label">Division</span>
              <select
                value={safeIdx}
                onChange={(e) => {
                  setFocusTeamId('')
                  setSelectedIdx(Number(e.target.value))
                }}
              >
                {divisions.map((d, i) => (
                  <option key={d.divisionId} value={i}>
                    {d.divisionName || `Division ${d.divisionId}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      {divisions.length === 0 ? (
        <p className="muted">No standings returned.</p>
      ) : (
        <>
          <div className="panel chart-panel">
            <h2>Wins by team</h2>
            <p className="muted small">
              Selected division:{' '}
              {selected?.divisionName || `ID ${selected?.divisionId}`}
            </p>
            <TeamWinsBarChart data={chartRows} />
          </div>

          <div className="panel chart-panel">
            <h2>Cumulative win % vs games played</h2>
            <p className="muted small">
              All clubs in this division load together. The horizontal axis is games
              completed (pace), not the calendar.
            </p>
            <MultiTeamWinPctChart
              teamIds={divisionTeamIds}
              season={data?.season ?? null}
              getLabel={(id: number) => abbrevById.get(id) ?? String(id)}
            />
          </div>

          {divisions.map((div) => (
            <div key={div.divisionId} className="panel">
              <h2>{div.divisionName || `Division ${div.divisionId}`}</h2>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Team</th>
                      <th scope="col">W</th>
                      <th scope="col">L</th>
                      <th scope="col">PCT</th>
                      <th scope="col">GB</th>
                      <th scope="col">WC GB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortStandingTeams(div.teams).map((t) => (
                      <tr key={t.teamId}>
                        <td>{t.divisionRank}</td>
                        <td>
                          <span className="team-cell">
                            <span className="team-abbr">
                              {abbrevById.get(t.teamId) ?? '—'}
                            </span>
                            <span className="team-name">{t.teamName}</span>
                          </span>
                        </td>
                        <td>{t.wins}</td>
                        <td>{t.losses}</td>
                        <td>{t.pct}</td>
                        <td>{t.gamesBack}</td>
                        <td>{t.wildCardGamesBack || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
