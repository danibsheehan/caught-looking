import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChartSuspense } from '../components/charts/ChartSuspense';
import PlayerCompareAheadChart from '../components/charts/PlayerCompareAheadChart';
import PlayerCompareStatsTable from '../components/charts/PlayerCompareStatsTable';

const PlayerRadar = lazy(() => import('../components/charts/PlayerRadar'));
const PlayerCompareCareerLines = lazy(
  () => import('../components/charts/PlayerCompareCareerLines'),
);
const PlayerCompareRecentSparklines = lazy(
  () => import('../components/charts/PlayerCompareRecentSparklines'),
);
const PlayerComparePlatoonBars = lazy(
  () => import('../components/charts/PlayerComparePlatoonBars'),
);
import ChartSkeleton from '../components/skeletons/ChartSkeleton';
import { PlayerPicker, type PlayerPick } from '../components/ui';
import { useChartSurfaceHex } from '../hooks/useChartSurfaceHex';
import { usePlayerCurrentTeams } from '../hooks/usePlayerCurrentTeams';
import {
  usePlayerCompareGameLog,
  usePlayerComparePlatoon,
  usePlayerCompareYearByYear,
} from '../hooks/usePlayerCompareTrends';
import { usePlayersCompare } from '../hooks/usePlayersCompare';
import type { YearByYearMetric } from '../types/api.compat';
import { adjustChartColorForSurface, CHART_INK_MIN_CONTRAST } from '../utils/chartColorContrast';
import {
  getObsidianTeamColor,
  resolveObsidianMatchupFills,
} from '../utils/mlbTeamObsidianRegistry';
import {
  buildPlayerCompareSearchParams,
  parsePlayerCompareSearchParams,
  playerCompareIdsQueryIsValid,
  type PlayerCompareUrlState,
} from '../utils/playerCompareSearchParams';
import {
  HITTING_CAREER_METRICS,
  PITCHING_CAREER_METRICS,
  yearByYearMetricShortLabel,
} from '../utils/yearByYearMetric';

function defaultCareerMetric(group: 'hitting' | 'pitching'): YearByYearMetric {
  return group === 'pitching' ? 'era' : 'ops';
}

export default function PlayerComparison() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parsePlayerCompareSearchParams(searchParams), [searchParams]);
  /**
   * Mid-Change search UI for one picker. Tied to the committed id pair so a URL update
   * (new pick, deep link, back/forward) drops the clear without an effect.
   */
  const [clearedPick, setClearedPick] = useState<{
    side: '1' | '2';
    id1: number;
    id2: number;
  } | null>(null);
  const clearedSide =
    clearedPick && clearedPick.id1 === urlState.id1 && clearedPick.id2 === urlState.id2
      ? clearedPick.side
      : null;

  const patchUrl = useCallback(
    (patch: Partial<PlayerCompareUrlState>) => {
      setSearchParams(
        (prev) => {
          const cur = parsePlayerCompareSearchParams(prev);
          return buildPlayerCompareSearchParams({ ...cur, ...patch }, prev);
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    setSearchParams(
      (prev) => {
        // Seed defaults when ids are missing, or replace invalid ids that parse fell back from.
        if (playerCompareIdsQueryIsValid(prev)) return prev;
        return buildPlayerCompareSearchParams(parsePlayerCompareSearchParams(prev), prev);
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const pick1: PlayerPick | null = useMemo(
    () => (clearedSide === '1' ? null : { id: urlState.id1, fullName: urlState.name1 }),
    [clearedSide, urlState.id1, urlState.name1],
  );
  const pick2: PlayerPick | null = useMemo(
    () => (clearedSide === '2' ? null : { id: urlState.id2, fullName: urlState.name2 }),
    [clearedSide, urlState.id2, urlState.name2],
  );
  const season = urlState.season;
  const compareScope = urlState.scope;
  const group = urlState.group;
  const careerMetric = urlState.metric;

  const setPick1 = useCallback(
    (p: PlayerPick | null) => {
      if (!p) {
        setClearedPick({ side: '1', id1: urlState.id1, id2: urlState.id2 });
        return;
      }
      setClearedPick((cur) => (cur?.side === '1' ? null : cur));
      patchUrl({
        id1: p.id,
        name1: p.fullName,
        id2: urlState.id2 === p.id ? urlState.id1 : urlState.id2,
        name2: urlState.id2 === p.id ? urlState.name1 : urlState.name2,
      });
    },
    [patchUrl, urlState.id1, urlState.id2, urlState.name1, urlState.name2],
  );
  const setPick2 = useCallback(
    (p: PlayerPick | null) => {
      if (!p) {
        setClearedPick({ side: '2', id1: urlState.id1, id2: urlState.id2 });
        return;
      }
      setClearedPick((cur) => (cur?.side === '2' ? null : cur));
      patchUrl({
        id2: p.id,
        name2: p.fullName,
        id1: urlState.id1 === p.id ? urlState.id2 : urlState.id1,
        name1: urlState.id1 === p.id ? urlState.name2 : urlState.name1,
      });
    },
    [patchUrl, urlState.id1, urlState.id2, urlState.name1, urlState.name2],
  );

  const p1 = pick1?.id ?? NaN;
  const p2 = pick2?.id ?? NaN;
  const valid = Number.isFinite(p1) && Number.isFinite(p2) && p1 > 0 && p2 > 0 && p1 !== p2;

  const {
    data: compareData,
    error: compareError,
    loading: compareLoading,
  } = usePlayersCompare({
    playerId1: p1,
    playerId2: p2,
    season,
    scope: compareScope,
    group,
    enabled: valid,
  });

  useEffect(() => {
    const a = compareData?.players?.[0];
    const b = compareData?.players?.[1];
    if (!a || !b) return;
    if (a.id !== urlState.id1 || b.id !== urlState.id2) return;
    if (a.fullName === urlState.name1 && b.fullName === urlState.name2) return;
    patchUrl({ name1: a.fullName, name2: b.fullName });
  }, [compareData, patchUrl, urlState.id1, urlState.id2, urlState.name1, urlState.name2]);

  const { teamId1: radarTeam1, teamId2: radarTeam2 } = usePlayerCurrentTeams(p1, p2, valid);

  const surfaceHex = useChartSurfaceHex();
  const compareRegistryChrome = useMemo(() => {
    if (radarTeam1 == null || radarTeam2 == null) return null;
    const fills = resolveObsidianMatchupFills(radarTeam1, radarTeam2);
    if (!fills) return null;
    const r1 = getObsidianTeamColor(radarTeam1);
    const r2 = getObsidianTeamColor(radarTeam2);
    return {
      swatchA: adjustChartColorForSurface(fills.awayFill, surfaceHex, CHART_INK_MIN_CONTRAST),
      swatchB: adjustChartColorForSurface(fills.homeFill, surfaceHex, CHART_INK_MIN_CONTRAST),
      abbrevA: r1?.abbrev ?? 'P1',
      abbrevB: r2?.abbrev ?? 'P2',
    };
  }, [radarTeam1, radarTeam2, surfaceHex]);

  const compareIds = valid && p1 != null && p2 != null ? `${p1},${p2}` : '';

  const showSeasonCharts = compareScope === 'season';
  const showCareerTrajectory = compareScope === 'career';
  const seasonChartsEnabled = valid && showSeasonCharts;
  const careerTrajectoryEnabled = valid && showCareerTrajectory;

  const {
    data: yearlyData,
    error: yearlyError,
    loading: yearlyLoading,
  } = usePlayerCompareYearByYear(compareIds, group, careerTrajectoryEnabled, careerMetric);

  const {
    data: gameLogData,
    error: gameLogError,
    loading: gameLogLoading,
  } = usePlayerCompareGameLog(compareIds, season, group, seasonChartsEnabled);

  const {
    data: platoonData,
    error: platoonError,
    loading: platoonLoading,
  } = usePlayerComparePlatoon(compareIds, season, group, seasonChartsEnabled);

  const gameLogRateLabel = group === 'hitting' ? 'OPS' : 'ERA';
  const careerMetricLabel = yearByYearMetricShortLabel(careerMetric);

  const snapshotSectionTitle = valid
    ? compareScope === 'career'
      ? 'Career snapshot'
      : `Season ${season} snapshot`
    : 'Comparison snapshot';

  const snapshotSectionLede = valid
    ? compareScope === 'career'
      ? 'Radar, matchup view, and totals use each player’s full regular-season career. Below: year-by-year arcs only — no single-season game log or platoon until you switch Compare to Season.'
      : `Radar, matchup view, and totals use ${season} regular-season stats only. Below: ${season} game log and platoon splits (year-by-year arcs appear when Compare is Career).`
    : 'Choose two different players to load radar, matchup charts, and tables.';

  return (
    <section className="page players-compare">
      <header className="players-compare__head">
        <div>
          <h1>Player comparison</h1>
          <p className="text text--muted">
            Compare two MLB players using the stats API. <strong>Season</strong> mode: same-year
            snapshot plus game log and platoon. <strong>Career</strong> mode: career snapshot plus
            year-by-year arcs (no single-season game log or platoon). Selection is reflected in the
            URL so you can share or bookmark a matchup.
          </p>
          {valid && compareRegistryChrome ? (
            <p
              className="text text--muted text--small players-compare__registry-key"
              aria-label="Chart color key"
            >
              <span className="players-compare__registry-key-label">Series colors</span>
              <span className="players-compare__registry-swatch-wrap">
                <span
                  className="players-compare__registry-swatch"
                  style={{ background: compareRegistryChrome.swatchA }}
                  aria-hidden
                />
                {compareRegistryChrome.abbrevA}
              </span>
              <span className="players-compare__registry-key-sep">·</span>
              <span className="players-compare__registry-swatch-wrap">
                <span
                  className="players-compare__registry-swatch"
                  style={{ background: compareRegistryChrome.swatchB }}
                  aria-hidden
                />
                {compareRegistryChrome.abbrevB}
              </span>
              <span className="players-compare__registry-key-hint">
                Current team · obsidian registry
              </span>
            </p>
          ) : null}
        </div>
      </header>

      <div className="players-compare__panel">
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
                const v = e.target.value;
                patchUrl({ scope: v === 'career' ? 'career' : 'season' });
              }}
            >
              <option value="season">Season</option>
              <option value="career">Career</option>
            </select>
          </label>
          <label className="players-compare__field">
            <span className="players-compare__label">Season year</span>
            <input
              className="players-compare__input"
              type="number"
              min={1900}
              max={2100}
              value={season}
              title={
                compareScope === 'career'
                  ? 'Pick the year for game log and platoon (those charts appear when Compare is set to Season).'
                  : 'Used for the season snapshot, game log, and platoon charts.'
              }
              onChange={(e) => patchUrl({ season: Number(e.target.value) || urlState.season })}
            />
          </label>
          <label className="players-compare__field">
            <span className="players-compare__label">Stat group</span>
            <select
              className="players-compare__select"
              value={group}
              onChange={(e) => {
                const v = e.target.value === 'pitching' ? 'pitching' : 'hitting';
                patchUrl({ group: v, metric: defaultCareerMetric(v) });
              }}
            >
              <option value="hitting">Hitting</option>
              <option value="pitching">Pitching</option>
            </select>
          </label>
        </div>
        {!valid ? (
          <p className="text text--muted players-compare__invalid-hint">
            Choose two different players to render the charts.
          </p>
        ) : null}
      </div>

      {valid ? (
        <div className="players-compare__scope-summary" role="note">
          <p className="players-compare__scope-summary-line">
            <span className="players-compare__scope-summary-label">Radar & totals</span>
            {compareScope === 'season' ? (
              <>
                Use <strong>{season}</strong> regular-season stats.
              </>
            ) : (
              <>
                Use <strong>career</strong> regular-season stats.
              </>
            )}
          </p>
          <p className="players-compare__scope-summary-line">
            <span className="players-compare__scope-summary-label">Season year ({season})</span>
            {compareScope === 'career' ? (
              <>
                <strong>Recent games</strong> and <strong>platoon splits</strong> are hidden in
                career mode. Set the year here, then switch Compare to <strong>Season</strong> to
                load those charts for {season}.
              </>
            ) : (
              <>
                Same year for snapshot, <strong>recent games</strong>, and{' '}
                <strong>platoon splits</strong>.
              </>
            )}
          </p>
          <p className="players-compare__scope-summary-line">
            <span className="players-compare__scope-summary-label">Year-by-year</span>
            {compareScope === 'career' ? (
              <>Full careers for the metric you pick — not limited to {season}.</>
            ) : (
              <>
                Hidden in season mode. Switch Compare to <strong>Career</strong> to load
                year-by-year charts.
              </>
            )}
          </p>
        </div>
      ) : null}

      <div className="players-compare__section players-compare__section--snapshot">
        <div className="players-compare__section-head">
          <p className="players-compare__section-eyebrow">Head-to-head</p>
          <h2 className="players-compare__section-title">{snapshotSectionTitle}</h2>
          <p className="players-compare__section-lede">{snapshotSectionLede}</p>
        </div>

        <div className="players-compare__panel players-compare__panel--chart">
          <h3 className="players-compare__chart-title">Radar</h3>
          <p className="text text--muted text--small">
            {compareScope === 'career'
              ? 'Career regular-season totals (pair-normalized per spoke).'
              : 'Season totals (pair-normalized per spoke).'}{' '}
            Better stat fills the spoke vs the other player.
          </p>
          {valid ? (
            <ChartSuspense height={420} label="Loading radar chart">
              <PlayerRadar
                key={`${p1}-${p2}-${compareScope}-${season}-${group}`}
                ready
                data={compareData}
                loading={compareLoading}
                error={compareError}
                group={group}
                teamId1={radarTeam1}
                teamId2={radarTeam2}
              />
            </ChartSuspense>
          ) : (
            <p className="text text--muted">
              Enter two different MLB player IDs and a season to compare.
            </p>
          )}
        </div>

        {valid && compareData ? (
          <>
            <div className="players-compare__panel players-compare__panel--chart">
              <h3 className="players-compare__chart-title">Who&apos;s ahead</h3>
              <p className="text text--muted text--small">
                Same metrics as the radar: each dumbbell shows pair-normalized strength (100 =
                better for that stat in this matchup). Hover a row for raw numbers.
              </p>
              <PlayerCompareAheadChart
                data={compareData}
                group={group}
                teamId1={radarTeam1}
                teamId2={radarTeam2}
              />
            </div>
            <div className="players-compare__panel players-compare__panel--chart">
              <h3 className="players-compare__chart-title">
                {compareData.scope === 'career' ? 'Career totals' : 'Season totals'}
              </h3>
              <p className="text text--muted text--small">
                Raw values from the same split as the radar. wOBA and FIP appear when provided by
                the stats API; some seasons or players omit them.
              </p>
              <PlayerCompareStatsTable data={compareData} group={group} />
            </div>
          </>
        ) : null}
      </div>

      {valid && showCareerTrajectory ? (
        <div className="players-compare__section players-compare__section--trajectory">
          <div className="players-compare__section-head">
            <p className="players-compare__section-eyebrow">Full careers</p>
            <h2 className="players-compare__section-title">Career trajectory</h2>
            <p className="players-compare__section-lede">
              Year-by-year regular-season rates for both players, plus a league baseline per season.
              Shown only while Compare is Career so single-season snapshots are not mixed with
              multi-year trends.
            </p>
          </div>
          <div className="players-compare__panel players-compare__panel--chart">
            <h3 className="players-compare__chart-title">Year-by-year</h3>
            <div className="players-compare__career-toolbar">
              <label className="players-compare__field">
                <span className="players-compare__label">Metric</span>
                <select
                  className="players-compare__select"
                  value={careerMetric}
                  onChange={(e) => patchUrl({ metric: e.target.value as YearByYearMetric })}
                >
                  {(group === 'pitching' ? PITCHING_CAREER_METRICS : HITTING_CAREER_METRICS).map(
                    (opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <p className="text text--muted text--small">
              {careerMetricLabel} each season. Dashed line is league context from AL+NL team season
              totals (not a player leaderboard average).
            </p>
            {yearlyLoading && !yearlyData ? (
              <ChartSkeleton height={380} label="Loading year-by-year stats" />
            ) : null}
            {yearlyError ? (
              <p className="text text--error" role="alert">
                {yearlyError.message}
              </p>
            ) : null}
            {yearlyData ? (
              <ChartSuspense height={400} label="Loading career trajectory chart">
                <PlayerCompareCareerLines
                  data={yearlyData}
                  teamId1={radarTeam1}
                  teamId2={radarTeam2}
                />
              </ChartSuspense>
            ) : null}
          </div>
        </div>
      ) : null}

      {valid && !showCareerTrajectory ? (
        <div className="players-compare__section players-compare__section--trajectory-muted">
          <p className="text text--muted players-compare__trajectory-hint">
            <strong>Year-by-year</strong> career arcs are off while Compare is set to Season. Switch
            Compare to <strong>Career</strong> to load them (same players and stat group).
          </p>
        </div>
      ) : null}

      {valid && showSeasonCharts ? (
        <div className="players-compare__section players-compare__section--season-year">
          <div className="players-compare__section-head">
            <p className="players-compare__section-eyebrow">Single season</p>
            <h2 className="players-compare__section-title">{season} · in-season detail</h2>
            <p className="players-compare__section-lede">
              Game log and platoon splits use the season year in the filters. Shown only while
              Compare is set to Season so career totals are not mixed with one year of micro stats.
            </p>
          </div>
          <div className="players-compare__panel players-compare__panel--chart">
            <h3 className="players-compare__chart-title">Recent games</h3>
            <p className="text text--muted text--small">
              Per-game {gameLogRateLabel} for the last games logged in {season} (up to 28).
              Horizontal reference: same league baseline as team-aggregate {gameLogRateLabel} for{' '}
              {season}.
            </p>
            {gameLogLoading && !gameLogData ? (
              <ChartSkeleton height={320} label="Loading game logs" />
            ) : null}
            {gameLogError ? (
              <p className="text text--error" role="alert">
                {gameLogError.message}
              </p>
            ) : null}
            {gameLogData ? (
              <ChartSuspense height={340} label="Loading game log chart">
                <PlayerCompareRecentSparklines
                  data={gameLogData}
                  teamId1={radarTeam1}
                  teamId2={radarTeam2}
                />
              </ChartSuspense>
            ) : null}
          </div>
          <div className="players-compare__panel players-compare__panel--chart">
            <h3 className="players-compare__chart-title">Platoon splits</h3>
            <p className="text text--muted text--small">
              {group === 'hitting'
                ? 'Regular-season OPS vs left-handed and right-handed pitchers (MLB statSplits).'
                : 'Regular-season opponent OPS vs left-handed and right-handed batters faced.'}
            </p>
            {platoonLoading && !platoonData ? (
              <ChartSkeleton height={300} label="Loading platoon splits" />
            ) : null}
            {platoonError ? (
              <p className="text text--error" role="alert">
                {platoonError.message}
              </p>
            ) : null}
            {platoonData ? (
              <ChartSuspense height={320} label="Loading platoon chart">
                <PlayerComparePlatoonBars
                  data={platoonData}
                  teamId1={radarTeam1}
                  teamId2={radarTeam2}
                />
              </ChartSuspense>
            ) : null}
          </div>
        </div>
      ) : null}

      {valid && !showSeasonCharts ? (
        <div className="players-compare__section players-compare__section--season-year-muted">
          <p className="text text--muted players-compare__season-charts-hint">
            Single-season <strong>game log</strong> and <strong>platoon</strong> charts are off
            while Compare is set to Career. Switch Compare to <strong>Season</strong> to load them
            for <strong>{season}</strong> (adjust the season year first if you need a different
            year).
          </p>
        </div>
      ) : null}
    </section>
  );
}
