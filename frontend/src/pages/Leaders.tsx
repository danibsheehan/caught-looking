import { useMemo, useState } from 'react';
import { useLeaders } from '../hooks/useLeaders';
import type { LeadersQuery } from '../types/api.compat';

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

/** Mirrors backend allowlist so the UI never queries a stale group/category pair. */
const CATEGORIES_BY_GROUP: Record<'hitting' | 'pitching', string[]> = {
  hitting: [
    'homeRuns',
    'battingAverage',
    'hits',
    'runsBattedIn',
    'onBasePlusSlugging',
    'onBasePercentage',
    'sluggingPercentage',
    'stolenBases',
    'runs',
  ],
  pitching: [
    'earnedRunAverage',
    'wins',
    'strikeouts',
    'saves',
    'walksAndHitsPerInningPitched',
    'strikeoutsPer9Inn',
    'strikeoutWalkRatio',
  ],
};

const DEFAULT_CATEGORY: Record<'hitting' | 'pitching', string> = {
  hitting: 'homeRuns',
  pitching: 'earnedRunAverage',
};

function labelCategory(code: string): string {
  return CATEGORY_LABELS[code] ?? code;
}

function categoryForGroup(group: 'hitting' | 'pitching', category: string): string {
  const cats = CATEGORIES_BY_GROUP[group];
  return cats.includes(category) ? category : DEFAULT_CATEGORY[group];
}

export default function Leaders() {
  const [group, setGroup] = useState<'hitting' | 'pitching'>('hitting');
  const [category, setCategory] = useState(DEFAULT_CATEGORY.hitting);
  const [season, setSeason] = useState<number | undefined>(undefined);

  const resolvedCategory = categoryForGroup(group, category);

  const query = useMemo<LeadersQuery>(
    () => ({
      group,
      category: resolvedCategory,
      season,
      limit: 10,
    }),
    [group, resolvedCategory, season],
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
          </p>
        </div>
      </header>

      <div className="leaders-page__controls" role="group" aria-label="Leaders filters">
        <div className="leaders-page__tabs" role="tablist" aria-label="Stat group">
          {(['hitting', 'pitching'] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={group === g}
              className={
                group === g ? 'leaders-page__tab leaders-page__tab--active' : 'leaders-page__tab'
              }
              onClick={() => {
                setGroup(g);
                setCategory(DEFAULT_CATEGORY[g]);
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
            value={resolvedCategory}
            onChange={(e) => setCategory(e.target.value)}
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
                setSeason(undefined);
                return;
              }
              const n = Number(v);
              if (Number.isFinite(n)) setSeason(n);
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
