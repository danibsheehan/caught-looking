import { useMemo, useState } from 'react'
import { WinLossChart } from '../components/charts'
import TeamPageSkeleton from '../components/skeletons/TeamPageSkeleton'
import { PlayerCard, StatCard, TeamSelector } from '../components/ui'
import { useStandings, useTeamSeasonStats, useTeams } from '../hooks/useMLB'
import { standingTeamForId } from '../utils/standings'

const DEFAULT_SEASON = 2026

function formatSignedInt(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  if (v === 0) return '0'
  return v > 0 ? `+${v}` : String(v)
}

function formatSlashThree(v: number | undefined): string {
  if (v == null || Number.isNaN(v) || v === 0) return '—'
  const s = v.toFixed(3)
  return s.startsWith('0.') ? s.slice(1) : s
}

function formatTwo(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toFixed(2)
}

function formatStandingToken(dashOrValue: string | undefined): string {
  if (dashOrValue == null || dashOrValue === '' || dashOrValue === '-') return '—'
  return dashOrValue
}

export default function TeamOverview() {
  const { data, loading, error } = useTeams({ sportId: '1' })
  const teams = useMemo(() => data?.teams ?? [], [data])
  const [teamId, setTeamId] = useState<number | ''>('')
  const [season, setSeason] = useState(DEFAULT_SEASON)
  const [panelTab, setPanelTab] = useState<'trend' | 'deep'>('trend')

  const {
    data: standingsData,
    loading: standingsLoading,
    error: standingsError,
  } = useStandings({ season })

  const selected = useMemo(() => {
    if (teamId === '') return null
    return teams.find((t) => t.id === teamId) ?? null
  }, [teams, teamId])

  const snapshot = useMemo(() => {
    if (!selected) return null
    return standingTeamForId(standingsData?.divisions, selected.id)
  }, [standingsData, selected])

  const {
    data: deepStats,
    loading: deepLoading,
    error: deepError,
  } = useTeamSeasonStats(selected ? selected.id : '', season)

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
            Club snapshot from standings, cumulative win %, and season hitting /
            pitching lines.
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
            <span className="field-label">Season</span>
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

          <div className="panel team-snapshot">
            <h2 className="team-snapshot-heading">Season snapshot</h2>
            <p className="muted small team-snapshot-lead">
              Race and form from regular-season standings (same season as above).
            </p>
            {standingsLoading ? (
              <p className="muted small">Loading standings…</p>
            ) : standingsError ? (
              <p className="error" role="alert">
                {standingsError.message}
              </p>
            ) : snapshot ? (
              <>
                <p className="muted small">
                  {snapshot.division.divisionName} · Division rank{' '}
                  {snapshot.team.divisionRank}
                </p>
                <div className="stat-cards stat-cards--wide">
                  <StatCard
                    label="Record"
                    value={`${snapshot.team.wins}-${snapshot.team.losses}`}
                  />
                  <StatCard label="Win %" value={snapshot.team.pct} />
                  <StatCard
                    label="GB"
                    value={formatStandingToken(snapshot.team.gamesBack)}
                  />
                  <StatCard
                    label="WC GB"
                    value={formatStandingToken(snapshot.team.wildCardGamesBack)}
                  />
                  <StatCard
                    label="RS / RA"
                    value={`${snapshot.team.runsScored ?? '—'} / ${snapshot.team.runsAllowed ?? '—'}`}
                  />
                  <StatCard
                    label="Run diff"
                    value={formatSignedInt(snapshot.team.runDifferential)}
                  />
                  <StatCard
                    label="Home"
                    value={
                      snapshot.team.homeWins != null
                        ? `${snapshot.team.homeWins}-${snapshot.team.homeLosses ?? 0}`
                        : '—'
                    }
                  />
                  <StatCard
                    label="Away"
                    value={
                      snapshot.team.awayWins != null
                        ? `${snapshot.team.awayWins}-${snapshot.team.awayLosses ?? 0}`
                        : '—'
                    }
                  />
                  <StatCard
                    label="Last 10"
                    value={
                      snapshot.team.lastTenWins != null
                        ? `${snapshot.team.lastTenWins}-${snapshot.team.lastTenLosses ?? 0}`
                        : '—'
                    }
                  />
                  <StatCard
                    label="Streak"
                    value={snapshot.team.streak || '—'}
                  />
                </div>
              </>
            ) : (
              <p className="muted small">
                No standings row for this club and season yet.
              </p>
            )}
          </div>

          <div className="panel segment-panel">
            <div className="segment-tabs" role="tablist" aria-label="Team views">
              <button
                type="button"
                role="tab"
                className="segment-tab"
                aria-selected={panelTab === 'trend'}
                onClick={() => setPanelTab('trend')}
              >
                Season win %
              </button>
              <button
                type="button"
                role="tab"
                className="segment-tab"
                aria-selected={panelTab === 'deep'}
                onClick={() => setPanelTab('deep')}
              >
                Deep dive
              </button>
            </div>

            {panelTab === 'trend' ? (
              <div className="chart-panel">
                <h2>Cumulative win %</h2>
                <p className="muted small">
                  Built from the club schedule; each point is after a completed
                  game.
                </p>
                <WinLossChart
                  key={`${selected.id}-${season}`}
                  teamId={selected.id}
                  season={season}
                />
              </div>
            ) : (
              <>
                <h2>Team stats (season)</h2>
                <p className="muted small">
                  Full-team hitting and pitching totals for the season.
                </p>
                {deepLoading ? (
                  <p className="muted small">Loading team stats…</p>
                ) : deepError ? (
                  <p className="error" role="alert">
                    {deepError.message}
                  </p>
                ) : deepStats ? (
                  <>
                    <h3 className="deep-dive-section-title">Offense</h3>
                    <div className="stat-cards stat-cards--wide">
                      <StatCard
                        label="Runs / G"
                        value={formatTwo(deepStats.hitting.runsPerGame)}
                      />
                      <StatCard
                        label="OPS"
                        value={
                          deepStats.hitting.gamesPlayed
                            ? formatSlashThree(deepStats.hitting.ops)
                            : '—'
                        }
                      />
                      <StatCard
                        label="OBP"
                        value={
                          deepStats.hitting.gamesPlayed
                            ? formatSlashThree(deepStats.hitting.obp)
                            : '—'
                        }
                      />
                      <StatCard
                        label="SLG"
                        value={
                          deepStats.hitting.gamesPlayed
                            ? formatSlashThree(deepStats.hitting.slg)
                            : '—'
                        }
                      />
                      <StatCard
                        label="AVG"
                        value={
                          deepStats.hitting.gamesPlayed
                            ? formatSlashThree(deepStats.hitting.avg)
                            : '—'
                        }
                      />
                      <StatCard label="Runs (total)" value={deepStats.hitting.runs} />
                    </div>
                    <h3 className="deep-dive-section-title">Pitching</h3>
                    <div className="stat-cards stat-cards--wide">
                      <StatCard
                        label="RA / G"
                        value={formatTwo(deepStats.pitching.runsAllowedPerGame)}
                      />
                      <StatCard
                        label="ERA"
                        value={
                          deepStats.pitching.gamesPlayed
                            ? formatTwo(deepStats.pitching.era)
                            : '—'
                        }
                      />
                      <StatCard
                        label="WHIP"
                        value={
                          deepStats.pitching.gamesPlayed
                            ? formatTwo(deepStats.pitching.whip)
                            : '—'
                        }
                      />
                      <StatCard
                        label="K/9"
                        value={
                          deepStats.pitching.gamesPlayed
                            ? formatTwo(deepStats.pitching.k9)
                            : '—'
                        }
                      />
                      <StatCard
                        label="BB/9"
                        value={
                          deepStats.pitching.gamesPlayed
                            ? formatTwo(deepStats.pitching.bb9)
                            : '—'
                        }
                      />
                      <StatCard
                        label="Runs allowed"
                        value={deepStats.pitching.runsAllowed}
                      />
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : (
        <p className="muted">Choose a team to load snapshot and charts.</p>
      )}
    </section>
  )
}
