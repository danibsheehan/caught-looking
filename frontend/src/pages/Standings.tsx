import { lazy, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { ChartSuspense } from '../components/charts/ChartSuspense';

const MultiTeamWinPctChart = lazy(() => import('../components/charts/MultiTeamWinPctChart'));
const TeamWinsBarChart = lazy(() => import('../components/charts/TeamWinsBarChart'));
import { StatCard, TeamSelector } from '../components/ui';
import { useChartSurfaceHex } from '../hooks/useChartSurfaceHex';
import { useStandings, useTeams } from '../hooks/useMLB';
import StandingsPageSkeleton from '../components/skeletons/StandingsPageSkeleton';
import { obsidianRegistryLabelMap } from '../utils/mlbTeamColors';
import { divisionIndexForTeam, sortStandingTeams, teamLabelMap } from '../utils/standings';
import {
  buildStandingsSearchParams,
  parseStandingsSearchParams,
  standingsSearchParamsNormalized,
  type StandingsUrlState,
} from '../utils/standingsSearchParams';

export default function Standings() {
  const { data: teamsData } = useTeams({ sportId: '1' });
  const { data, error, loading } = useStandings({});
  const surfaceHex = useChartSurfaceHex();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseStandingsSearchParams(searchParams), [searchParams]);

  const abbrevById = useMemo(() => teamLabelMap(teamsData), [teamsData]);

  const divisions = useMemo(() => data?.divisions ?? [], [data]);
  const teams = teamsData?.teams ?? [];

  const patchUrl = useCallback(
    (patch: Partial<StandingsUrlState>) => {
      setSearchParams(
        (prev) => {
          const cur = parseStandingsSearchParams(prev);
          return buildStandingsSearchParams({ ...cur, ...patch }, prev);
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    setSearchParams(
      (prev) => {
        if (standingsSearchParamsNormalized(prev)) return prev;
        return buildStandingsSearchParams(parseStandingsSearchParams(prev), prev);
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const selectedIdx = useMemo(() => {
    if (urlState.teamId !== '') {
      const byTeam = divisionIndexForTeam(divisions, urlState.teamId);
      if (byTeam >= 0) return byTeam;
    }
    if (urlState.divisionId !== '') {
      const byDiv = divisions.findIndex((d) => d.divisionId === urlState.divisionId);
      if (byDiv >= 0) return byDiv;
    }
    return 0;
  }, [divisions, urlState.divisionId, urlState.teamId]);

  const focusTeamId = urlState.teamId;
  const safeIdx = Math.min(Math.max(0, selectedIdx), Math.max(0, divisions.length - 1));
  const selected = divisions[safeIdx];

  const chartRows = useMemo(() => {
    if (!selected?.teams?.length) return [];
    return sortStandingTeams(selected.teams).map((t) => ({
      abbrev: abbrevById.get(t.teamId) ?? t.teamName,
      wins: t.wins,
      teamId: t.teamId,
    }));
  }, [selected, abbrevById]);

  /** Division rank order — matches bar + win-% colors. */
  const divisionTeamIdsByRank = useMemo(
    () => sortStandingTeams(selected?.teams ?? []).map((t) => t.teamId),
    [selected],
  );

  const divisionHeroTeamIds = useMemo(() => {
    const rows = sortStandingTeams(selected?.teams ?? []);
    if (rows.length < 2) return rows.map((t) => t.teamId);
    return [rows[0]!.teamId, rows[1]!.teamId];
  }, [selected]);

  const standingsLabelByTeamId = useMemo(() => {
    const ids = new Set<number>();
    for (const d of divisions) {
      for (const t of d.teams) ids.add(t.teamId);
    }
    const list = [...ids];
    return list.length ? obsidianRegistryLabelMap(list, surfaceHex) : new Map();
  }, [divisions, surfaceHex]);

  function onTeamSelected(id: number | '') {
    if (id === '') {
      const div = divisions[safeIdx];
      patchUrl({ teamId: '', divisionId: div?.divisionId ?? '' });
      return;
    }
    patchUrl({ teamId: id, divisionId: '' });
  }

  if (loading && !data) {
    return <StandingsPageSkeleton />;
  }

  if (error) {
    return (
      <section className="page standings-page">
        <h1>Standings</h1>
        <p className="error" role="alert">
          {error.message}
        </p>
        <p className="muted">
          Is the Go API running? With the default Vite proxy, start the backend on port 8080, or set{' '}
          <code>VITE_API_BASE</code> to your API origin.
        </p>
      </section>
    );
  }

  const teamsInDivision = selected?.teams?.length ?? 0;

  return (
    <section className="page standings-page">
      <header className="standings-page__header">
        <div>
          <h1>Standings</h1>
          <p className="muted">
            Season <strong>{data?.season ?? '—'}</strong> · regular season · AL / NL
          </p>
          <div className="standings-page__stat-cards" role="list">
            <div role="listitem">
              <StatCard label="Season" value={data?.season ?? '—'} />
            </div>
            <div role="listitem">
              <StatCard label="Divisions" value={divisions.length} />
            </div>
            <div role="listitem">
              <StatCard label="Teams (chart)" value={teamsInDivision} hint="Selected division" />
            </div>
          </div>
        </div>
        <div className="standings-page__controls">
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
            <label className="form-field">
              <span className="form-field__label">Division</span>
              <select
                className="form-field__select"
                value={safeIdx}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  const div = divisions[idx];
                  patchUrl({ teamId: '', divisionId: div?.divisionId ?? '' });
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
          <div className="standings-page__panel standings-page__panel--chart">
            <h2>Wins by team</h2>
            <p className="muted small">
              Selected division: {selected?.divisionName || `ID ${selected?.divisionId}`}
            </p>
            <ChartSuspense height={320} label="Loading wins chart">
              <TeamWinsBarChart data={chartRows} />
            </ChartSuspense>
          </div>

          <div className="standings-page__panel standings-page__panel--chart">
            <h2>Cumulative win % vs games played</h2>
            <p className="muted small">
              All clubs in this division load together. The horizontal axis is games completed
              (pace), not the calendar.
            </p>
            <ChartSuspense height={360} label="Loading win % chart">
              <MultiTeamWinPctChart
                teamIds={divisionTeamIdsByRank}
                season={data?.season ?? null}
                getLabel={(id: number) => abbrevById.get(id) ?? String(id)}
                heroTeamIds={divisionHeroTeamIds}
              />
            </ChartSuspense>
          </div>

          {selected ? (
            <div key={selected.divisionId} className="standings-page__panel">
              <h2>{selected.divisionName || `Division ${selected.divisionId}`}</h2>
              <div className="standings-page__table-scroll">
                <table className="standings-page__table">
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
                    {sortStandingTeams(selected.teams).map((t) => (
                      <tr key={t.teamId}>
                        <td>{t.divisionRank}</td>
                        <td>
                          <span className="standings-page__team-cell">
                            <span
                              className="standings-page__team-abbr"
                              style={{
                                color: standingsLabelByTeamId.get(t.teamId) ?? 'var(--text-h)',
                              }}
                            >
                              {abbrevById.get(t.teamId) ?? '—'}
                            </span>
                            <span className="standings-page__team-name">{t.teamName}</span>
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
          ) : null}
        </>
      )}
    </section>
  );
}
