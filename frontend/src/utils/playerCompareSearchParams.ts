import type { YearByYearMetric } from '../types/api.compat';
import { HITTING_CAREER_METRICS, PITCHING_CAREER_METRICS } from './yearByYearMetric';

export type PlayerCompareScope = 'season' | 'career';
export type PlayerCompareGroup = 'hitting' | 'pitching';

export type PlayerCompareUrlState = {
  id1: number;
  id2: number;
  name1: string;
  name2: string;
  season: number;
  scope: PlayerCompareScope;
  group: PlayerCompareGroup;
  metric: YearByYearMetric;
};

export const DEFAULT_PLAYER_COMPARE_URL: PlayerCompareUrlState = {
  id1: 660271,
  id2: 592450,
  name1: 'Shohei Ohtani',
  name2: 'Aaron Judge',
  season: 2026,
  scope: 'season',
  group: 'hitting',
  metric: 'ops',
};

const ALL_METRICS = new Set<string>([
  ...HITTING_CAREER_METRICS.map((m) => m.value),
  ...PITCHING_CAREER_METRICS.map((m) => m.value),
]);

function defaultMetric(group: PlayerCompareGroup): YearByYearMetric {
  return group === 'pitching' ? 'era' : 'ops';
}

function parsePositiveInt(raw: string | null): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function parseSeason(raw: string | null, fallback: number): number {
  const n = parsePositiveInt(raw);
  if (n == null || n < 1900 || n > 2100) return fallback;
  return n;
}

function metricForGroup(group: PlayerCompareGroup, raw: string | null): YearByYearMetric {
  const fallback = defaultMetric(group);
  if (raw == null || !ALL_METRICS.has(raw)) return fallback;
  const allowed =
    group === 'pitching'
      ? PITCHING_CAREER_METRICS.map((m) => m.value)
      : HITTING_CAREER_METRICS.map((m) => m.value);
  return allowed.includes(raw as YearByYearMetric) ? (raw as YearByYearMetric) : fallback;
}

/**
 * Read `/players` query state. Missing or invalid fields fall back to portfolio defaults
 * (Ohtani / Judge, current season hitting snapshot).
 */
export function parsePlayerCompareSearchParams(
  sp: URLSearchParams,
  defaults: PlayerCompareUrlState = DEFAULT_PLAYER_COMPARE_URL,
): PlayerCompareUrlState {
  const idsRaw = sp.get('ids');
  let id1 = defaults.id1;
  let id2 = defaults.id2;
  if (idsRaw) {
    const parts = idsRaw.split(',').map((s) => s.trim());
    const a = parsePositiveInt(parts[0] ?? null);
    const b = parsePositiveInt(parts[1] ?? null);
    if (a != null && b != null && a !== b) {
      id1 = a;
      id2 = b;
    }
  }

  const group: PlayerCompareGroup = sp.get('group') === 'pitching' ? 'pitching' : 'hitting';
  const scope: PlayerCompareScope = sp.get('scope') === 'career' ? 'career' : 'season';
  const season = parseSeason(sp.get('season'), defaults.season);
  const metric = metricForGroup(group, sp.get('metric'));

  const name1 = sp.get('n1')?.trim() || (id1 === defaults.id1 ? defaults.name1 : `Player ${id1}`);
  const name2 = sp.get('n2')?.trim() || (id2 === defaults.id2 ? defaults.name2 : `Player ${id2}`);

  return { id1, id2, name1, name2, season, scope, group, metric };
}

/** Write compare state into a copy of `prev` (omits default-ish noise where safe). */
export function buildPlayerCompareSearchParams(
  state: PlayerCompareUrlState,
  prev: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.set('ids', `${state.id1},${state.id2}`);
  next.set('season', String(state.season));
  next.set('scope', state.scope);
  next.set('group', state.group);
  next.set('metric', state.metric);
  if (state.name1.trim()) next.set('n1', state.name1.trim());
  else next.delete('n1');
  if (state.name2.trim()) next.set('n2', state.name2.trim());
  else next.delete('n2');
  return next;
}
