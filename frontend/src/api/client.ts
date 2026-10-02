import type {
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  GameStatcastResponse,
  GameTimelineResponse,
  GamesForDateQuery,
  GamesForDateResponse,
  LeadersQuery,
  LeadersResponse,
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

/** Response / request header used for FE↔BE log correlation (chi RequestID). */
export const REQUEST_ID_HEADER = 'X-Request-ID';

export type ApiGetOptions = {
  signal?: AbortSignal;
};

/** Non-OK API response; `message` includes request id when the header was present. */
export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;
  /** Upstream/API error text without the request-id suffix. */
  readonly apiMessage: string;

  constructor(message: string, options: { status: number; requestId?: string }) {
    const requestId = options.requestId?.trim() || undefined;
    const display = requestId !== undefined ? `${message} (request ${requestId})` : message;
    super(display);
    this.name = 'ApiError';
    this.status = options.status;
    this.requestId = requestId;
    this.apiMessage = message;
  }
}

export async function apiGet<T>(path: string, options?: ApiGetOptions): Promise<T> {
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${p}`;
  const res =
    options?.signal !== undefined ? await fetch(url, { signal: options.signal }) : await fetch(url);
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res), {
      status: res.status,
      requestId: readRequestId(res),
    });
  }
  return (await res.json()) as T;
}

function readRequestId(res: Response): string | undefined {
  const v = res.headers.get(REQUEST_ID_HEADER);
  const trimmed = v?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : undefined;
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

/** One query param: [key, value, include?]. `include` defaults to {@link isSet}. */
type QueryParam = readonly [key: string, value: unknown, include?: (v: unknown) => boolean];

const isSet = (v: unknown): boolean => v != null;
const isTruthy = (v: unknown): boolean => Boolean(v);
const isPositive = (v: unknown): boolean => typeof v === 'number' && v > 0;

/**
 * Builds `path` with a `?`-prefixed query string from `params`, preserving param order.
 * Each param is included when its `include` predicate (default {@link isSet}) returns true for
 * its value; excluded params are left out entirely. Returns `path` unchanged when no param
 * qualifies.
 */
function withQuery(path: string, params: readonly QueryParam[]): string {
  const qs = new URLSearchParams();
  for (const [key, value, include = isSet] of params) {
    if (include(value)) qs.set(key, String(value));
  }
  const suffix = qs.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export async function fetchStandings(
  query: StandingsQuery = {},
  signal?: AbortSignal,
): Promise<StandingsResponse> {
  const path = withQuery('/standings', [
    ['season', query.season],
    ['leagueId', query.leagueId, isTruthy],
    ['standingsTypes', query.standingsTypes, isTruthy],
  ]);
  return apiGet<StandingsResponse>(path, apiOpts(signal));
}

export async function fetchLeaders(
  query: LeadersQuery = {},
  signal?: AbortSignal,
): Promise<LeadersResponse> {
  const path = withQuery('/leaders', [
    ['season', query.season],
    ['group', query.group, isTruthy],
    ['category', query.category, isTruthy],
    ['limit', query.limit],
  ]);
  return apiGet<LeadersResponse>(path, apiOpts(signal));
}

export async function fetchTeams(
  query: TeamsQuery = {},
  signal?: AbortSignal,
): Promise<TeamsResponse> {
  const path = withQuery('/teams', [['sportId', query.sportId, isTruthy]]);
  return apiGet<TeamsResponse>(path, apiOpts(signal));
}

export async function fetchTeamSeasonStats(
  teamId: number,
  query: TeamSeasonStatsQuery = {},
  signal?: AbortSignal,
): Promise<TeamSeasonStatsResponse> {
  const path = withQuery(`/teams/${teamId}/season-stats`, [['season', query.season]]);
  return apiGet<TeamSeasonStatsResponse>(path, apiOpts(signal));
}

export async function fetchRecordTimeline(
  teamId: number,
  query: RecordTimelineQuery = {},
  signal?: AbortSignal,
): Promise<RecordTimelineResponse> {
  const path = withQuery(`/teams/${teamId}/record-timeline`, [['season', query.season]]);
  return apiGet<RecordTimelineResponse>(path, apiOpts(signal));
}

export async function fetchRecordTimelinesBatch(
  query: RecordTimelinesBatchQuery,
  signal?: AbortSignal,
): Promise<RecordTimelinesBatchResponse> {
  const ids = query.teamIds.filter((id) => id > 0);
  if (ids.length === 0) {
    throw new Error('fetchRecordTimelinesBatch: teamIds must include at least one id');
  }
  const path = withQuery('/record-timelines/batch', [
    ['teamIds', ids.join(',')],
    ['season', query.season],
  ]);
  return apiGet<RecordTimelinesBatchResponse>(path, apiOpts(signal));
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
  const path = withQuery('/games/for-date', [
    ['date', query.date],
    ['teamId', query.teamId, isPositive],
  ]);
  return apiGet<GamesForDateResponse>(path, apiOpts(signal));
}

export async function fetchPlayersCompare(
  query: PlayersCompareQuery,
  signal?: AbortSignal,
): Promise<PlayersRadarResponse> {
  const path = withQuery('/players/compare', [
    ['ids', query.ids],
    ['scope', query.scope, isTruthy],
    ['season', query.season],
    ['group', query.group, isTruthy],
  ]);
  return apiGet<PlayersRadarResponse>(path, apiOpts(signal));
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
  const path = withQuery('/players/current-teams', [['ids', `${playerId1},${playerId2}`]]);
  return apiGet<PlayersCurrentTeamsResponse>(path, apiOpts(signal));
}

export async function fetchPlayersCompareYearByYear(
  query: PlayersCompareYearByYearQuery,
  signal?: AbortSignal,
): Promise<PlayersYearByYearResponse> {
  const path = withQuery('/players/compare/year-by-year', [
    ['ids', query.ids],
    ['group', query.group, isTruthy],
    ['metric', query.metric, isTruthy],
  ]);
  return apiGet<PlayersYearByYearResponse>(path, apiOpts(signal));
}

export async function fetchPlayersCompareGameLog(
  query: PlayersCompareGameLogQuery,
  signal?: AbortSignal,
): Promise<PlayersGameLogResponse> {
  const path = withQuery('/players/compare/game-log', [
    ['ids', query.ids],
    ['season', query.season],
    ['group', query.group, isTruthy],
    ['limit', query.limit],
  ]);
  return apiGet<PlayersGameLogResponse>(path, apiOpts(signal));
}

export async function fetchPlayersComparePlatoon(
  query: PlayersComparePlatoonQuery,
  signal?: AbortSignal,
): Promise<PlayersPlatoonResponse> {
  const path = withQuery('/players/compare/platoon', [
    ['ids', query.ids],
    ['season', query.season],
    ['group', query.group, isTruthy],
  ]);
  return apiGet<PlayersPlatoonResponse>(path, apiOpts(signal));
}

export async function fetchPlayersSearch(
  query: PlayersSearchQuery,
  signal?: AbortSignal,
): Promise<PlayersSearchResponse> {
  const path = withQuery('/players/search', [['names', query.names]]);
  return apiGet<PlayersSearchResponse>(path, apiOpts(signal));
}
