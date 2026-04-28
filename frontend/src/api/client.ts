import type {
  GameBoxscoreResponse,
  GameStatcastPitchesResponse,
  GameStatcastResponse,
  GameTimelineResponse,
  GamesForDateQuery,
  GamesForDateResponse,
  LeagueSeasonBaselineResponse,
  PlayerCurrentTeamResponse,
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
} from '../types/api.compat'

/**
 * Base URL for the Go API.
 * - Dev (default): `/api` → Vite proxy strips prefix and forwards to the backend.
 * - Prod / direct: set `VITE_API_BASE` (e.g. `http://localhost:8080`) with no trailing slash.
 */
const envBase = import.meta.env.VITE_API_BASE

export const API_BASE =
  envBase != null && String(envBase).trim() !== ''
    ? String(envBase).replace(/\/$/, '')
    : '/api'

export async function apiGet<T>(path: string): Promise<T> {
  const p = path.startsWith('/') ? path : `/${path}`
  const url = `${API_BASE}${p}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

export async function fetchStandings(
  query: StandingsQuery = {},
): Promise<StandingsResponse> {
  const qs = new URLSearchParams()
  if (query.season != null) qs.set('season', String(query.season))
  if (query.leagueId) qs.set('leagueId', query.leagueId)
  if (query.standingsTypes) qs.set('standingsTypes', query.standingsTypes)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet<StandingsResponse>(`/standings${suffix}`)
}

export async function fetchTeams(query: TeamsQuery = {}): Promise<TeamsResponse> {
  const qs = new URLSearchParams()
  if (query.sportId) qs.set('sportId', query.sportId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet<TeamsResponse>(`/teams${suffix}`)
}

export async function fetchTeamSeasonStats(
  teamId: number,
  query: TeamSeasonStatsQuery = {},
): Promise<TeamSeasonStatsResponse> {
  const qs = new URLSearchParams()
  if (query.season != null) qs.set('season', String(query.season))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet<TeamSeasonStatsResponse>(
    `/teams/${teamId}/season-stats${suffix}`,
  )
}

export async function fetchRecordTimeline(
  teamId: number,
  query: RecordTimelineQuery = {},
): Promise<RecordTimelineResponse> {
  const qs = new URLSearchParams()
  if (query.season != null) qs.set('season', String(query.season))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet<RecordTimelineResponse>(
    `/teams/${teamId}/record-timeline${suffix}`,
  )
}

export async function fetchRecordTimelinesBatch(
  query: RecordTimelinesBatchQuery,
): Promise<RecordTimelinesBatchResponse> {
  const ids = query.teamIds.filter((id) => id > 0)
  if (ids.length === 0) {
    throw new Error('fetchRecordTimelinesBatch: teamIds must include at least one id')
  }
  const qs = new URLSearchParams()
  qs.set('teamIds', ids.join(','))
  if (query.season != null) qs.set('season', String(query.season))
  return apiGet<RecordTimelinesBatchResponse>(
    `/record-timelines/batch?${qs.toString()}`,
  )
}

export async function fetchGameTimeline(
  gamePk: number | string,
): Promise<GameTimelineResponse> {
  return apiGet<GameTimelineResponse>(`/games/${gamePk}/timeline`)
}

export async function fetchGameBoxscore(
  gamePk: number | string,
): Promise<GameBoxscoreResponse> {
  return apiGet<GameBoxscoreResponse>(`/games/${gamePk}/boxscore`)
}

export async function fetchGameStatcast(
  gamePk: number | string,
): Promise<GameStatcastResponse> {
  return apiGet<GameStatcastResponse>(`/games/${gamePk}/statcast`)
}

export async function fetchGameStatcastPitches(
  gamePk: number | string,
): Promise<GameStatcastPitchesResponse> {
  return apiGet<GameStatcastPitchesResponse>(`/games/${gamePk}/statcast/pitches`)
}

export async function fetchGamesForDate(
  query: GamesForDateQuery,
): Promise<GamesForDateResponse> {
  const qs = new URLSearchParams()
  qs.set('date', query.date)
  if (query.teamId != null && query.teamId > 0) {
    qs.set('teamId', String(query.teamId))
  }
  return apiGet<GamesForDateResponse>(`/games/for-date?${qs.toString()}`)
}

export async function fetchPlayersCompare(
  query: PlayersCompareQuery,
): Promise<PlayersRadarResponse> {
  const qs = new URLSearchParams()
  qs.set('ids', query.ids)
  if (query.scope) qs.set('scope', query.scope)
  if (query.season != null) qs.set('season', String(query.season))
  if (query.group) qs.set('group', query.group)
  return apiGet<PlayersRadarResponse>(`/players/compare?${qs.toString()}`)
}

export async function fetchPlayerCurrentTeam(
  playerId: number,
): Promise<PlayerCurrentTeamResponse> {
  return apiGet<PlayerCurrentTeamResponse>(
    `/players/${playerId}/current-team`,
  )
}

export async function fetchLeagueSeasonBaseline(
  query: { season?: number; group?: 'hitting' | 'pitching' },
): Promise<LeagueSeasonBaselineResponse> {
  const qs = new URLSearchParams()
  if (query.season != null) qs.set('season', String(query.season))
  if (query.group) qs.set('group', query.group)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet<LeagueSeasonBaselineResponse>(`/league/season-baseline${suffix}`)
}

export async function fetchPlayersCompareYearByYear(
  query: PlayersCompareYearByYearQuery,
): Promise<PlayersYearByYearResponse> {
  const qs = new URLSearchParams()
  qs.set('ids', query.ids)
  if (query.group) qs.set('group', query.group)
  if (query.metric) qs.set('metric', query.metric)
  return apiGet<PlayersYearByYearResponse>(
    `/players/compare/year-by-year?${qs.toString()}`,
  )
}

export async function fetchPlayersCompareGameLog(
  query: PlayersCompareGameLogQuery,
): Promise<PlayersGameLogResponse> {
  const qs = new URLSearchParams()
  qs.set('ids', query.ids)
  if (query.season != null) qs.set('season', String(query.season))
  if (query.group) qs.set('group', query.group)
  if (query.limit != null) qs.set('limit', String(query.limit))
  return apiGet<PlayersGameLogResponse>(
    `/players/compare/game-log?${qs.toString()}`,
  )
}

export async function fetchPlayersComparePlatoon(
  query: PlayersComparePlatoonQuery,
): Promise<PlayersPlatoonResponse> {
  const qs = new URLSearchParams()
  qs.set('ids', query.ids)
  if (query.season != null) qs.set('season', String(query.season))
  if (query.group) qs.set('group', query.group)
  return apiGet<PlayersPlatoonResponse>(
    `/players/compare/platoon?${qs.toString()}`,
  )
}

export async function fetchPlayersSearch(
  query: PlayersSearchQuery,
): Promise<PlayersSearchResponse> {
  const qs = new URLSearchParams()
  qs.set('names', query.names)
  return apiGet<PlayersSearchResponse>(`/players/search?${qs.toString()}`)
}
