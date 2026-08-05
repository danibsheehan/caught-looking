export type TeamOverviewTab = 'trend' | 'deep';

export type TeamOverviewUrlState = {
  teamId: number | '';
  season: number;
  tab: TeamOverviewTab;
};

export const DEFAULT_TEAM_OVERVIEW_SEASON = 2026;

export const DEFAULT_TEAM_OVERVIEW_URL: TeamOverviewUrlState = {
  teamId: '',
  season: DEFAULT_TEAM_OVERVIEW_SEASON,
  tab: 'trend',
};

export function parseTeamOverviewSearchParams(sp: URLSearchParams): TeamOverviewUrlState {
  const teamRaw = sp.get('team');
  let teamId: number | '' = '';
  if (teamRaw != null && teamRaw.trim() !== '') {
    const n = Number(teamRaw);
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) teamId = n;
  }
  const seasonRaw = sp.get('season');
  let season = DEFAULT_TEAM_OVERVIEW_SEASON;
  if (seasonRaw != null && seasonRaw.trim() !== '') {
    const n = Number(seasonRaw);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 1900 && n <= 2100) season = n;
  }
  const tab: TeamOverviewTab = sp.get('tab') === 'deep' ? 'deep' : 'trend';
  return { teamId, season, tab };
}

export function buildTeamOverviewSearchParams(
  state: TeamOverviewUrlState,
  prev: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const next = new URLSearchParams(prev);
  if (state.teamId === '') next.delete('team');
  else next.set('team', String(state.teamId));
  next.set('season', String(state.season));
  if (state.tab === 'trend') next.delete('tab');
  else next.set('tab', state.tab);
  return next;
}
