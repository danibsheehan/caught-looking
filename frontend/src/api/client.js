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

/**
 * Typed GET against the Go API. Response shape must match the server contract.
 * @template T
 * @param {string} path Absolute path on the API, e.g. `/standings?season=2026`
 * @returns {Promise<T>}
 */
export async function apiGet(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const url = `${API_BASE}${p}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  /** @type {T} */
  const json = await res.json()
  return json
}

/**
 * @param {import('../types/api').StandingsQuery} [query]
 * @returns {Promise<import('../types/api').StandingsResponse>}
 */
export async function fetchStandings(query = {}) {
  const qs = new URLSearchParams()
  if (query.season != null) qs.set('season', String(query.season))
  if (query.leagueId) qs.set('leagueId', query.leagueId)
  if (query.standingsTypes) qs.set('standingsTypes', query.standingsTypes)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const raw = await apiGet(`/standings${suffix}`)
  return /** @type {import('../types/api').StandingsResponse} */ (raw)
}

/**
 * @param {import('../types/api').TeamsQuery} [query]
 * @returns {Promise<import('../types/api').TeamsResponse>}
 */
export async function fetchTeams(query = {}) {
  const qs = new URLSearchParams()
  if (query.sportId) qs.set('sportId', query.sportId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const raw = await apiGet(`/teams${suffix}`)
  return /** @type {import('../types/api').TeamsResponse} */ (raw)
}

/**
 * @param {number} teamId
 * @param {import('../types/api').RecordTimelineQuery} [query]
 * @returns {Promise<import('../types/api').RecordTimelineResponse>}
 */
/**
 * @param {number} teamId
 * @param {import('../types/api').TeamSeasonStatsQuery} [query]
 * @returns {Promise<import('../types/api').TeamSeasonStatsResponse>}
 */
export async function fetchTeamSeasonStats(teamId, query = {}) {
  const qs = new URLSearchParams()
  if (query.season != null) qs.set('season', String(query.season))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const raw = await apiGet(`/teams/${teamId}/season-stats${suffix}`)
  return /** @type {import('../types/api').TeamSeasonStatsResponse} */ (raw)
}

export async function fetchRecordTimeline(teamId, query = {}) {
  const qs = new URLSearchParams()
  if (query.season != null) qs.set('season', String(query.season))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const raw = await apiGet(`/teams/${teamId}/record-timeline${suffix}`)
  return /** @type {import('../types/api').RecordTimelineResponse} */ (raw)
}

/**
 * @param {import('../types/api').RecordTimelinesBatchQuery} query
 * @returns {Promise<import('../types/api').RecordTimelinesBatchResponse>}
 */
export async function fetchRecordTimelinesBatch(query) {
  const ids = query.teamIds.filter((id) => id > 0)
  if (ids.length === 0) {
    throw new Error('fetchRecordTimelinesBatch: teamIds must include at least one id')
  }
  const qs = new URLSearchParams()
  qs.set('teamIds', ids.join(','))
  if (query.season != null) qs.set('season', String(query.season))
  const raw = await apiGet(`/record-timelines/batch?${qs.toString()}`)
  return /** @type {import('../types/api').RecordTimelinesBatchResponse} */ (raw)
}

/**
 * @param {number | string} gamePk
 * @returns {Promise<import('../types/api').GameTimelineResponse>}
 */
export async function fetchGameTimeline(gamePk) {
  const raw = await apiGet(`/games/${gamePk}/timeline`)
  return /** @type {import('../types/api').GameTimelineResponse} */ (raw)
}

/**
 * @param {number | string} gamePk
 * @returns {Promise<import('../types/api').GameBoxscoreResponse>}
 */
export async function fetchGameBoxscore(gamePk) {
  const raw = await apiGet(`/games/${gamePk}/boxscore`)
  return /** @type {import('../types/api').GameBoxscoreResponse} */ (raw)
}

/**
 * @param {import('../types/api').GamesForDateQuery} query
 * @returns {Promise<import('../types/api').GamesForDateResponse>}
 */
export async function fetchGamesForDate(query) {
  const qs = new URLSearchParams()
  qs.set('date', query.date)
  if (query.teamId != null && query.teamId > 0) {
    qs.set('teamId', String(query.teamId))
  }
  const raw = await apiGet(`/games/for-date?${qs.toString()}`)
  return /** @type {import('../types/api').GamesForDateResponse} */ (raw)
}

/**
 * @param {import('../types/api').PlayersCompareQuery} query
 * @returns {Promise<import('../types/api').PlayersRadarResponse>}
 */
export async function fetchPlayersCompare(query) {
  const qs = new URLSearchParams()
  qs.set('ids', query.ids)
  if (query.season != null) qs.set('season', String(query.season))
  if (query.group) qs.set('group', query.group)
  const raw = await apiGet(`/players/compare?${qs.toString()}`)
  return /** @type {import('../types/api').PlayersRadarResponse} */ (raw)
}

/**
 * @param {import('../types/api').PlayersSearchQuery} query
 * @returns {Promise<import('../types/api').PlayersSearchResponse>}
 */
export async function fetchPlayersSearch(query) {
  const qs = new URLSearchParams()
  qs.set('names', query.names)
  const raw = await apiGet(`/players/search?${qs.toString()}`)
  return /** @type {import('../types/api').PlayersSearchResponse} */ (raw)
}
