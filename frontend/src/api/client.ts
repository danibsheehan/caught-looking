import type {
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  GameStatcastResponse,
  GameTimelineResponse,
  GamesForDateQuery,
  GamesForDateResponse,
  LeadersQuery,
  LeadersResponse,
  LeagueSeasonBaselineResponse,
  PlayerCurrentTeamResponse,
  PlayersCurrentTeamsResponse,
  PlayersCompareGameLogQuery,
  PlayersComparePlatoonQuery,
  PlayersCompareQuery,
  PlayersCompareYearByYearQuery,
  PlayersGameLogResponse,
  PlayersPlatoonResponse,
  PlayersRadarResponse,
  PlayersYearByYearResponse,
  PlayersSearchQuery,
  PlayersSearchResponse,
  RecordTimelineQuery,
  RecordTimelinesBatchQuery,
  RecordTimelinesBatchResponse,
  RecordTimelineResponse,
  StandingsQuery,
  StandingsResponse,
  TeamSeasonStatsQuery,
  TeamSeasonStatsResponse,
  TeamsQuery,
  TeamsResponse,
} from '../types/api.compat';

/**
 * Base URL for the Go API.
 * - Dev (default): `/api` → Vite proxy strips prefix and forwards to the backend.
 * - Prod / direct: set `VITE_API_BASE` (e.g. `http://localhost:8080`) with no trailing slash.
 */
const envBase = import.meta.env.VITE_API_BASE;

export const API_BASE =
  envBase != null && String(envBase).trim() !== '' ? String(envBase).replace(/\/$/, '') : '/api';

export type ApiGetOptions = {
  signal?: AbortSignal;
};

export async function apiGet<T>(path: string, options?: ApiGetOptions): Promise<T> {
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${p}`;
  const res =
    options?.signal !== undefined ? await fetch(url, { signal: options.signal }) : await fetch(url);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as T;
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) {
    return `${res.status} ${res.statusText}`;
  }
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim() !== '') {
      return parsed.error;
    }
  } catch {
    // non-JSON body (HTML gateway pages, plain text, etc.)
  }
  return text;
}

function apiOpts(signal?: AbortSignal): ApiGetOptions | undefined {
  return signal !== undefined ? { signal } : undefined;
}

export async function fetchStandings(
  query: StandingsQuery = {},
  signal?: AbortSignal,
): Promise<StandingsResponse> {
  const qs = new URLSearchParams();
  if (query.season != null) qs.set('season', String(query.season));
  if (query.leagueId) qs.set('leagueId', query.leagueId);
  if (query.standingsTypes) qs.set('standingsTypes', query.standingsTypes);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<StandingsResponse>(`/standings${suffix}`, apiOpts(signal));
}

export async function fetchLeaders(
  query: LeadersQuery = {},
  signal?: AbortSignal,
): Promise<LeadersResponse> {
  const qs = new URLSearchParams();
  if (query.season != null) qs.set('season', String(query.season));
  if (query.group) qs.set('group', query.group);
  if (query.category) qs.set('category', query.category);
  if (query.limit != null) qs.set('limit', String(query.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<LeadersResponse>(`/leaders${suffix}`, apiOpts(signal));
}

export async function fetchTeams(
  query: TeamsQuery = {},
  signal?: AbortSignal,
): Promise<TeamsResponse> {
  const qs = new URLSearchParams();
  if (query.sportId) qs.set('sportId', query.sportId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<TeamsResponse>(`/teams${suffix}`, apiOpts(signal));
}

export async function fetchTeamSeasonStats(
  teamId: number,
  query: TeamSeasonStatsQuery = {},
  signal?: AbortSignal,
): Promise<TeamSeasonStatsResponse> {
  const qs = new URLSearchParams();
  if (query.season != null) qs.set('season', String(query.season));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<TeamSeasonStatsResponse>(`/teams/${teamId}/season-stats${suffix}`, apiOpts(signal));
}

export async function fetchRecordTimeline(
  teamId: number,
  query: RecordTimelineQuery = {},
  signal?: AbortSignal,
): Promise<RecordTimelineResponse> {
  const qs = new URLSearchParams();
  if (query.season != null) qs.set('season', String(query.season));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<RecordTimelineResponse>(
    `/teams/${teamId}/record-timeline${suffix}`,
    apiOpts(signal),
  );
}

export async function fetchRecordTimelinesBatch(
  query: RecordTimelinesBatchQuery,
  signal?: AbortSignal,
): Promise<RecordTimelinesBatchResponse> {
  const ids = query.teamIds.filter((id) => id > 0);
  if (ids.length === 0) {
    throw new Error('fetchRecordTimelinesBatch: teamIds must include at least one id');
  }
  const qs = new URLSearchParams();
  qs.set('teamIds', ids.join(','));
  if (query.season != null) qs.set('season', String(query.season));
  return apiGet<RecordTimelinesBatchResponse>(
    `/record-timelines/batch?${qs.toString()}`,
    apiOpts(signal),
  );
}

export async function fetchGameTimeline(
  gamePk: number | string,
  signal?: AbortSignal,
): Promise<GameTimelineResponse> {
  return apiGet<GameTimelineResponse>(`/games/${gamePk}/timeline`, apiOpts(signal));
}

export async function fetchGameBoxscore(
  gamePk: number | string,
  signal?: AbortSignal,
): Promise<GameBoxscoreResponse> {
  return apiGet<GameBoxscoreResponse>(`/games/${gamePk}/boxscore`, apiOpts(signal));
}

export async function fetchGameStatcast(
  gamePk: number | string,
  signal?: AbortSignal,
): Promise<GameStatcastResponse> {
  return apiGet<GameStatcastResponse>(`/games/${gamePk}/statcast`, apiOpts(signal));
}

export async function fetchGameStatcastPitches(
  gamePk: number | string,
  signal?: AbortSignal,
): Promise<GameStatcastPitchesResponse> {
  return apiGet<GameStatcastPitchesResponse>(`/games/${gamePk}/statcast/pitches`, apiOpts(signal));
}

export async function fetchGamesForDate(
  query: GamesForDateQuery,
  signal?: AbortSignal,
): Promise<GamesForDateResponse> {
  const qs = new URLSearchParams();
  qs.set('date', query.date);
  if (query.teamId != null && query.teamId > 0) {
    qs.set('teamId', String(query.teamId));
  }
  return apiGet<GamesForDateResponse>(`/games/for-date?${qs.toString()}`, apiOpts(signal));
}

export async function fetchPlayersCompare(
  query: PlayersCompareQuery,
  signal?: AbortSignal,
): Promise<PlayersRadarResponse> {
  const qs = new URLSearchParams();
  qs.set('ids', query.ids);
  if (query.scope) qs.set('scope', query.scope);
  if (query.season != null) qs.set('season', String(query.season));
  if (query.group) qs.set('group', query.group);
  return apiGet<PlayersRadarResponse>(`/players/compare?${qs.toString()}`, apiOpts(signal));
}

export async function fetchPlayerCurrentTeam(
  playerId: number,
  signal?: AbortSignal,
): Promise<PlayerCurrentTeamResponse> {
  return apiGet<PlayerCurrentTeamResponse>(`/players/${playerId}/current-team`, apiOpts(signal));
}

/** Two players in one request (compare page); order matches {@link PlayersCurrentTeamsResponse.players}. */
export async function fetchPlayersCurrentTeams(
  playerId1: number,
  playerId2: number,
  signal?: AbortSignal,
): Promise<PlayersCurrentTeamsResponse> {
  if (
    !Number.isFinite(playerId1) ||
    !Number.isFinite(playerId2) ||
    playerId1 <= 0 ||
    playerId2 <= 0
  ) {
    throw new Error('fetchPlayersCurrentTeams: player ids must be positive numbers');
  }
  if (playerId1 === playerId2) {
    throw new Error('fetchPlayersCurrentTeams: player ids must differ');
  }
  const qs = new URLSearchParams();
  qs.set('ids', `${playerId1},${playerId2}`);
  return apiGet<PlayersCurrentTeamsResponse>(
    `/players/current-teams?${qs.toString()}`,
    apiOpts(signal),
  );
}

export async function fetchLeagueSeasonBaseline(
  query: { season?: number; group?: 'hitting' | 'pitching' },
  signal?: AbortSignal,
): Promise<LeagueSeasonBaselineResponse> {
  const qs = new URLSearchParams();
  if (query.season != null) qs.set('season', String(query.season));
  if (query.group) qs.set('group', query.group);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<LeagueSeasonBaselineResponse>(`/league/season-baseline${suffix}`, apiOpts(signal));
}

export async function fetchPlayersCompareYearByYear(
  query: PlayersCompareYearByYearQuery,
  signal?: AbortSignal,
): Promise<PlayersYearByYearResponse> {
  const qs = new URLSearchParams();
  qs.set('ids', query.ids);
  if (query.group) qs.set('group', query.group);
  if (query.metric) qs.set('metric', query.metric);
  return apiGet<PlayersYearByYearResponse>(
    `/players/compare/year-by-year?${qs.toString()}`,
    apiOpts(signal),
  );
}

export async function fetchPlayersCompareGameLog(
  query: PlayersCompareGameLogQuery,
  signal?: AbortSignal,
): Promise<PlayersGameLogResponse> {
  const qs = new URLSearchParams();
  qs.set('ids', query.ids);
  if (query.season != null) qs.set('season', String(query.season));
  if (query.group) qs.set('group', query.group);
  if (query.limit != null) qs.set('limit', String(query.limit));
  return apiGet<PlayersGameLogResponse>(
    `/players/compare/game-log?${qs.toString()}`,
    apiOpts(signal),
  );
}

export async function fetchPlayersComparePlatoon(
  query: PlayersComparePlatoonQuery,
  signal?: AbortSignal,
): Promise<PlayersPlatoonResponse> {
  const qs = new URLSearchParams();
  qs.set('ids', query.ids);
  if (query.season != null) qs.set('season', String(query.season));
  if (query.group) qs.set('group', query.group);
  return apiGet<PlayersPlatoonResponse>(
    `/players/compare/platoon?${qs.toString()}`,
    apiOpts(signal),
  );
}

export async function fetchPlayersSearch(
  query: PlayersSearchQuery,
  signal?: AbortSignal,
): Promise<PlayersSearchResponse> {
  const qs = new URLSearchParams();
  qs.set('names', query.names);
  return apiGet<PlayersSearchResponse>(`/players/search?${qs.toString()}`, apiOpts(signal));
}
