export type LeadersGroup = 'hitting' | 'pitching';

export type LeadersUrlState = {
  group: LeadersGroup;
  category: string;
  season: number | undefined;
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

export const DEFAULT_LEADERS_URL: LeadersUrlState = {
  group: 'hitting',
  category: 'homeRuns',
  season: undefined,
};

function categoryForGroup(group: LeadersGroup, category: string): string {
  const cats = CATEGORIES_BY_GROUP[group];
  return cats.includes(category) ? category : DEFAULT_CATEGORY[group];
}

export function parseLeadersSearchParams(sp: URLSearchParams): LeadersUrlState {
  const group: LeadersGroup = sp.get('group') === 'pitching' ? 'pitching' : 'hitting';
  const category = categoryForGroup(group, sp.get('category') ?? DEFAULT_CATEGORY[group]);
  const seasonRaw = sp.get('season');
  let season: number | undefined;
  if (seasonRaw != null && seasonRaw.trim() !== '') {
    const n = Number(seasonRaw);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 1900 && n <= 2100) {
      season = n;
    }
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
  if (state.season == null) next.delete('season');
  else next.set('season', String(state.season));
  return next;
}

export { CATEGORIES_BY_GROUP, DEFAULT_CATEGORY };
