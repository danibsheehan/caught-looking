import { useMemo, useState } from 'react'
import {
  DivisionRunsScatter,
  MultiTeamWinPctChart,
  RecordTimelineStrip,
  TeamSeasonDeepDive,
  WinLossChart,
} from '../components/charts'
import TeamPageSkeleton from '../components/skeletons/TeamPageSkeleton'
import { PlayerCard, StatCard, TeamSelector } from '../components/ui'
import { useStandings, useTeamSeasonStats, useTeams } from '../hooks/useMLB'
import { sortStandingTeams, standingTeamForId, teamLabelMap } from '../utils/standings'

const DEFAULT_SEASON = 2026

function formatSignedInt(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  if (v === 0) return '0'
  return v > 0 ? `+${v}` : String(v)
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

  const abbrevById = useMemo(() => teamLabelMap(data), [data])

  const divisionTeamIds = useMemo(() => {
    if (!snapshot) return []
    return sortStandingTeams(snapshot.division.teams).map((t) => t.teamId)
  }, [snapshot])

  const scatterPoints = useMemo(() => {
    if (!snapshot) return []
    return sortStandingTeams(snapshot.division.teams)
      .filter(
        (t) =>
          t.runsScored != null &&
          t.runsAllowed != null &&
          !Number.isNaN(t.runsScored) &&
          !Number.isNaN(t.runsAllowed),
      )
      .map((t) => ({
        teamId: t.teamId,
        rs: t.runsScored as number,
        ra: t.runsAllowed as number,
        label: abbrevById.get(t.teamId) ?? t.teamName,
      }))
  }, [snapshot, abbrevById])

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
      <section className="page teams-page">
        <h1>Teams</h1>
        <p className="error" role="alert">
          {error.message}
        </p>
      </section>
    )
  }

  return (
    <section className="page teams-page">
      <header className="teams-page__header">
        <div>
          <h1>Teams</h1>
          <p className="muted">
            Division charts (win %, run differential, game results) plus season
            hitting / pitching lines.
          </p>
        </div>
        <div className="teams-page__controls">
          <TeamSelector
            id="team-overview-selector"
            label="Club"
            teams={teams}
            value={teamId}
            onChange={setTeamId}
            placeholder="Select a team"
          />
          <label className="teams-page__field">
            <span className="teams-page__field-label">Season</span>
            <input
              className="teams-page__field-input"
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
            <dl className="player-card__meta">
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

          <div className="teams-page__panel">
            <h2 className="teams-page__snapshot-heading">Season snapshot</h2>
            <p className="muted small teams-page__snapshot-lead">
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
                <div className="teams-page__stat-cards teams-page__stat-cards--wide">
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

          <div className="teams-page__viz-grid">
            <div className="teams-page__panel teams-page__panel--chart">
              <h2>Runs scored vs. allowed</h2>
              <p className="muted small">
                Season totals for every club in this division. The dashed line is
                even run differential (RS = RA). Above it scores more than it allows.
              </p>
              <DivisionRunsScatter
                points={scatterPoints}
                focusTeamId={selected.id}
              />
            </div>
            <div className="teams-page__panel teams-page__panel--chart">
              <h2>Game-by-game results</h2>
              <p className="muted small">
                One tile per completed game in schedule order (scroll on long
                seasons).
              </p>
              <RecordTimelineStrip teamId={selected.id} season={season} />
            </div>
          </div>

          <div className="teams-page__panel teams-page__panel--segment">
            <div className="teams-page__tabs" role="tablist" aria-label="Team views">
              <button
                type="button"
                role="tab"
                className="teams-page__tab"
                aria-selected={panelTab === 'trend'}
                onClick={() => setPanelTab('trend')}
              >
                Season win %
              </button>
              <button
                type="button"
                role="tab"
                className="teams-page__tab"
                aria-selected={panelTab === 'deep'}
                onClick={() => setPanelTab('deep')}
              >
                Deep dive
              </button>
            </div>

            {panelTab === 'trend' ? (
              <div className="teams-page__chart-area">
                <h2>Division race — cumulative win %</h2>
                <p className="muted small">
                  Every team in this division on the same pace axis (games
                  completed). Your club is emphasized.
                </p>
                {divisionTeamIds.length > 1 ? (
                  <MultiTeamWinPctChart
                    key={`${selected.id}-${season}-div`}
                    teamIds={divisionTeamIds}
                    season={season}
                    getLabel={(id) => abbrevById.get(id) ?? String(id)}
                    focusTeamId={selected.id}
                  />
                ) : (
                  <WinLossChart
                    key={`${selected.id}-${season}`}
                    teamId={selected.id}
                    season={season}
                  />
                )}
              </div>
            ) : (
              <>
                <h2>Team stats (season)</h2>
                <p className="muted small">
                  Rate stats as horizontal bars (fixed scales); R/G vs RA/G on one
                  track at the top when both sides have games.
                </p>
                {deepLoading ? (
                  <p className="muted small">Loading team stats…</p>
                ) : deepError ? (
                  <p className="error" role="alert">
                    {deepError.message}
                  </p>
                ) : deepStats ? (
                  <TeamSeasonDeepDive stats={deepStats} teamId={selected.id} />
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
