export type LeadersGroup = 'hitting' | 'pitching';

export type LeadersUrlState = {
  group: LeadersGroup;
  category: string;
  season: number;
};

const CATEGORIES_BY_GROUP: Record<LeadersGroup, string[]> = {
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

const DEFAULT_CATEGORY: Record<LeadersGroup, string> = {
  hitting: 'homeRuns',
  pitching: 'earnedRunAverage',
};

/** Same default year as Teams / Players shareable URLs. */
export const DEFAULT_LEADERS_SEASON = 2026;

export const DEFAULT_LEADERS_URL: LeadersUrlState = {
  group: 'hitting',
  category: 'homeRuns',
  season: DEFAULT_LEADERS_SEASON,
};

function categoryForGroup(group: LeadersGroup, category: string): string {
  const cats = CATEGORIES_BY_GROUP[group];
  return cats.includes(category) ? category : DEFAULT_CATEGORY[group];
}

/** Keep shareable season years in the 1900–2100 window used by parse. */
export function clampLeadersSeason(n: number): number {
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1900 || n > 2100) {
    return DEFAULT_LEADERS_SEASON;
  }
  return n;
}

export function parseLeadersSearchParams(sp: URLSearchParams): LeadersUrlState {
  const group: LeadersGroup = sp.get('group') === 'pitching' ? 'pitching' : 'hitting';
  const category = categoryForGroup(group, sp.get('category') ?? DEFAULT_CATEGORY[group]);
  const seasonRaw = sp.get('season');
  let season = DEFAULT_LEADERS_SEASON;
  if (seasonRaw != null && seasonRaw.trim() !== '') {
    const n = Number(seasonRaw);
    season = clampLeadersSeason(n);
  }
  return { group, category, season };
}

export function buildLeadersSearchParams(
  state: LeadersUrlState,
  prev: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.set('group', state.group);
  next.set('category', state.category);
  next.set('season', String(clampLeadersSeason(state.season)));
  return next;
}

/** True when the query string already matches the normalized leaders URL state. */
export function leadersSearchParamsNormalized(sp: URLSearchParams): boolean {
  const built = buildLeadersSearchParams(parseLeadersSearchParams(sp), sp);
  return (
    sp.get('group') === built.get('group') &&
    sp.get('category') === built.get('category') &&
    sp.get('season') === built.get('season')
  );
}

export { CATEGORIES_BY_GROUP, DEFAULT_CATEGORY };
