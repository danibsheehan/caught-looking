import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useLeaders } from '../hooks/useLeaders';
import type { LeadersQuery } from '../types/api.compat';
import {
  CATEGORIES_BY_GROUP,
  DEFAULT_CATEGORY,
  buildLeadersSearchParams,
  parseLeadersSearchParams,
  type LeadersGroup,
} from '../utils/leadersSearchParams';

const CATEGORY_LABELS: Record<string, string> = {
  homeRuns: 'Home runs',
  battingAverage: 'Batting average',
  hits: 'Hits',
  runsBattedIn: 'RBI',
  onBasePlusSlugging: 'OPS',
  onBasePercentage: 'OBP',
  sluggingPercentage: 'SLG',
  stolenBases: 'Stolen bases',
  runs: 'Runs',
  earnedRunAverage: 'ERA',
  wins: 'Wins',
  strikeouts: 'Strikeouts',
  saves: 'Saves',
  walksAndHitsPerInningPitched: 'WHIP',
  strikeoutsPer9Inn: 'K/9',
  strikeoutWalkRatio: 'K/BB',
};

function labelCategory(code: string): string {
  return CATEGORY_LABELS[code] ?? code;
}

export default function Leaders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseLeadersSearchParams(searchParams), [searchParams]);
  const { group, category, season } = urlState;

  const patchUrl = useCallback(
    (patch: Partial<typeof urlState>) => {
      setSearchParams(
        (prev) => {
          const cur = parseLeadersSearchParams(prev);
          return buildLeadersSearchParams({ ...cur, ...patch }, prev);
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    setSearchParams(
      (prev) => {
        if (prev.get('group') || prev.get('category')) return prev;
        return buildLeadersSearchParams(parseLeadersSearchParams(prev), prev);
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const query = useMemo<LeadersQuery>(
    () => ({
      group,
      category,
      season,
      limit: 10,
    }),
    [group, category, season],
  );

  const { data, error, loading } = useLeaders(query);

  const categories =
    data?.group === group && data.categories.length > 0
      ? data.categories
      : CATEGORIES_BY_GROUP[group];

  const seasonValue = data?.group === group ? data.season : (season ?? '');
  const table = data?.group === group ? data : null;

  return (
    <section className="page leaders-page">
      <header className="leaders-page__header">
        <div>
          <h1>Leaders</h1>
          <p className="muted">
            Regular-season MLB leaders
            {seasonValue !== '' ? (
              <>
                {' '}
                · season <strong>{seasonValue}</strong>
              </>
            ) : null}
            . Filters stay in the URL for sharing.
          </p>
        </div>
      </header>

      <div className="leaders-page__controls" role="group" aria-label="Leaders filters">
        <div className="leaders-page__tabs" role="tablist" aria-label="Stat group">
          {(['hitting', 'pitching'] as const).map((g: LeadersGroup) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={group === g}
              className={
                group === g ? 'leaders-page__tab leaders-page__tab--active' : 'leaders-page__tab'
              }
              onClick={() => {
                patchUrl({ group: g, category: DEFAULT_CATEGORY[g] });
              }}
            >
              {g === 'hitting' ? 'Hitting' : 'Pitching'}
            </button>
          ))}
        </div>

        <label className="form-field leaders-page__field">
          <span className="form-field__label">Category</span>
          <select
            className="form-field__control"
            value={category}
            onChange={(e) => patchUrl({ category: e.target.value })}
            disabled={loading && !table}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {labelCategory(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field leaders-page__field">
          <span className="form-field__label">Season</span>
          <input
            className="form-field__control"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            placeholder="Default"
            value={season ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === '') {
                patchUrl({ season: undefined });
                return;
              }
              const n = Number(v);
              if (Number.isFinite(n)) patchUrl({ season: n });
            }}
          />
        </label>
      </div>

      {loading && !table ? <p className="muted">Loading leaders…</p> : null}

      {error ? (
        <p className="error" role="alert">
          {error.message}
        </p>
      ) : null}

      {table ? (
        <div className="leaders-page__table-wrap">
          <table
            className="leaders-page__table"
            aria-label={`${labelCategory(table.category)} leaders for ${table.season}`}
          >
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col">Team</th>
                <th scope="col">Lg</th>
                <th scope="col">{labelCategory(table.category)}</th>
              </tr>
            </thead>
            <tbody>
              {table.leaders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No leaders for this selection.
                  </td>
                </tr>
              ) : (
                table.leaders.map((row) => (
                  <tr key={`${row.rank}-${row.playerId}`}>
                    <td>{row.rank}</td>
                    <td>{row.playerName}</td>
                    <td>{row.teamName || '—'}</td>
                    <td>{row.leagueName || '—'}</td>
                    <td className="leaders-page__value">{row.value}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
