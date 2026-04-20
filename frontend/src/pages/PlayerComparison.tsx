import { useState } from 'react'
import {
  PlayerCompareAheadChart,
  PlayerCompareCareerLines,
  PlayerCompareRecentSparklines,
  PlayerCompareStatsTable,
  PlayerRadar,
} from '../components/charts'
import ChartSkeleton from '../components/skeletons/ChartSkeleton'
import { PlayerPicker, type PlayerPick } from '../components/ui'
import { usePlayerCurrentTeams } from '../hooks/usePlayerCurrentTeams'
import {
  usePlayerCompareGameLog,
  usePlayerCompareYearByYear,
} from '../hooks/usePlayerCompareTrends'
import { usePlayersCompare } from '../hooks/usePlayersCompare'

const DEFAULT_SEASON = 2026

export default function PlayerComparison() {
  const [pick1, setPick1] = useState<PlayerPick | null>({
    id: 660271,
    fullName: 'Shohei Ohtani',
  })
  const [pick2, setPick2] = useState<PlayerPick | null>({
    id: 592450,
    fullName: 'Aaron Judge',
  })
  const [season, setSeason] = useState(DEFAULT_SEASON)
  const [compareScope, setCompareScope] = useState<'season' | 'career'>('season')
  const [group, setGroup] = useState<'hitting' | 'pitching'>('hitting')

  const p1 = pick1?.id
  const p2 = pick2?.id
  const valid =
    p1 != null &&
    p2 != null &&
    Number.isFinite(p1) &&
    Number.isFinite(p2) &&
    p1 > 0 &&
    p2 > 0 &&
    p1 !== p2

  const { data: compareData, error: compareError, loading: compareLoading } =
    usePlayersCompare({
      playerId1: p1,
      playerId2: p2,
      season,
      scope: compareScope,
      group,
      enabled: valid,
    })

  const { teamId1: radarTeam1, teamId2: radarTeam2 } = usePlayerCurrentTeams(
    p1,
    p2,
    valid,
  )

  const compareIds =
    valid && p1 != null && p2 != null ? `${p1},${p2}` : ''

  const {
    data: yearlyData,
    error: yearlyError,
    loading: yearlyLoading,
  } = usePlayerCompareYearByYear(compareIds, group, valid)

  const {
    data: gameLogData,
    error: gameLogError,
    loading: gameLogLoading,
  } = usePlayerCompareGameLog(compareIds, season, group, valid)

  const rateLabel = group === 'hitting' ? 'OPS' : 'ERA'

  return (
    <section className="page players-compare">
      <header className="page-head">
        <div>
          <h1>Player comparison</h1>
          <p className="muted">
            Search by name (MLB stats API via this app), then compare season or career
            stats — including career arcs and recent-game trends when available.
          </p>
        </div>
      </header>

      <div className="panel">
        <div className="players-compare__pick-grid">
          <PlayerPicker label="Player 1" selected={pick1} onChange={setPick1} />
          <PlayerPicker label="Player 2" selected={pick2} onChange={setPick2} />
        </div>
        <div className="players-compare__filters">
          <label className="players-compare__field">
            <span className="players-compare__label">Compare</span>
            <select
              className="players-compare__select"
              value={compareScope}
              onChange={(e) => {
                const v = e.target.value
                setCompareScope(v === 'career' ? 'career' : 'season')
              }}
            >
              <option value="season">Season</option>
              <option value="career">Career</option>
            </select>
          </label>
          <label className="players-compare__field">
            <span className="players-compare__label">Season</span>
            <input
              className="players-compare__input"
              type="number"
              min={1900}
              max={2100}
              value={season}
              disabled={compareScope === 'career'}
              title={
                compareScope === 'career'
                  ? 'Career totals use full MLB career. Season year still selects the game-log window below.'
                  : undefined
              }
              onChange={(e) => setSeason(Number(e.target.value) || DEFAULT_SEASON)}
            />
          </label>
          <label className="players-compare__field">
            <span className="players-compare__label">Stat group</span>
            <select
              className="players-compare__select"
              value={group}
              onChange={(e) => {
                const v = e.target.value
                setGroup(v === 'pitching' ? 'pitching' : 'hitting')
              }}
            >
              <option value="hitting">Hitting</option>
              <option value="pitching">Pitching</option>
            </select>
          </label>
        </div>
        {!valid ? (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Choose two different players to render the chart.
          </p>
        ) : null}
      </div>

      {valid ? (
        <div className="panel chart-panel">
          <h2>Career arc</h2>
          <p className="muted small">
            Year-by-year {rateLabel} (regular season). Dashed line is league context:
            OPS or ERA implied by MLB team season totals (AL+NL), not a player
            leaderboard average.
          </p>
          {yearlyLoading && !yearlyData ? (
            <ChartSkeleton height={380} label="Loading year-by-year stats" />
          ) : null}
          {yearlyError ? (
            <p className="error" role="alert">
              {yearlyError.message}
            </p>
          ) : null}
          {yearlyData ? (
            <PlayerCompareCareerLines
              data={yearlyData}
              teamId1={radarTeam1}
              teamId2={radarTeam2}
            />
          ) : null}
        </div>
      ) : null}

      {valid ? (
        <div className="panel chart-panel">
          <h2>Recent games ({season})</h2>
          <p className="muted small">
            Per-game {rateLabel} for the last games logged in that season (up to 28).
            Horizontal reference: same league baseline as team-aggregate {rateLabel}{' '}
            for {season}.
          </p>
          {gameLogLoading && !gameLogData ? (
            <ChartSkeleton height={320} label="Loading game logs" />
          ) : null}
          {gameLogError ? (
            <p className="error" role="alert">
              {gameLogError.message}
            </p>
          ) : null}
          {gameLogData ? (
            <PlayerCompareRecentSparklines
              data={gameLogData}
              teamId1={radarTeam1}
              teamId2={radarTeam2}
            />
          ) : null}
        </div>
      ) : null}

      <div className="panel chart-panel">
        <h2>Radar</h2>
        <p className="muted small">
          {compareScope === 'career'
            ? 'Career regular-season totals (pair-normalized per spoke).'
            : 'Season totals (pair-normalized per spoke).'}{' '}
          Better stat fills the spoke vs the other player.
        </p>
        <PlayerRadar
          key={`${p1}-${p2}-${compareScope}-${season}-${group}`}
          ready={valid}
          data={compareData}
          loading={compareLoading}
          error={compareError}
          group={group}
          teamId1={radarTeam1}
          teamId2={radarTeam2}
        />
      </div>

      {valid && compareData ? (
        <>
          <div className="panel chart-panel">
            <h2>Who&apos;s ahead</h2>
            <p className="muted small">
              Same metrics as the radar: each dumbbell shows pair-normalized strength
              (100 = better for that stat in this matchup). Hover a row for raw
              numbers.
            </p>
            <PlayerCompareAheadChart
              data={compareData}
              group={group}
              teamId1={radarTeam1}
              teamId2={radarTeam2}
            />
          </div>
          <div className="panel chart-panel">
            <h2>{compareData.scope === 'career' ? 'Career totals' : 'Season totals'}</h2>
            <p className="muted small">
              Raw values from the same split as the radar. wOBA and FIP appear when
              provided by the stats API; some seasons or players omit them.
            </p>
            <PlayerCompareStatsTable data={compareData} group={group} />
          </div>
        </>
      ) : null}
    </section>
  )
}
