/**
 * JSON shapes returned by `caught-looking/backend` handlers.
 * Keep in sync with `backend/models/*.go` field names and types.
 */

/** Query string for `GET /standings` */
export interface StandingsQuery {
  season?: number
  leagueId?: string
  standingsTypes?: string
}

/** Query string for `GET /teams` */
export interface TeamsQuery {
  sportId?: string
}

export interface Team {
  id: number
  name: string
  abbreviation: string
  teamName: string
  leagueId: number
  leagueName: string
  divisionId: number
  divisionName: string
  active: boolean
}

export interface TeamsResponse {
  teams: Team[]
}

export interface StandingTeam {
  teamId: number
  teamName: string
  wins: number
  losses: number
  pct: string
  gamesPlayed: number
  divisionRank: string
  gamesBack: string
  wildCardGamesBack?: string
}

export interface StandingDivision {
  divisionId: number
  divisionName: string
  leagueId: number
  teams: StandingTeam[]
}

export interface StandingsResponse {
  season: number
  divisions: StandingDivision[]
}

export interface RecordPoint {
  gameIndex: number
  officialDate: string
  result: string
  wins: number
  losses: number
  pct: number
}

export interface RecordTimelineResponse {
  teamId: number
  season: number
  points: RecordPoint[]
  finishedGames: number
}

export interface InningScore {
  inning: number
  homeRuns: number
  awayRuns: number
}

export interface GameTimelineResponse {
  gamePk: number
  homeTeam: string
  awayTeam: string
  homeId: number
  awayId: number
  innings: InningScore[]
  homeTotal: number
  awayTotal: number
}

export interface PlayerStatSnapshot {
  id: number
  fullName: string
  group: string
  stats: Record<string, number>
}

export interface PlayersRadarResponse {
  season: number
  group: string
  players: PlayerStatSnapshot[]
}

export interface RecordTimelineQuery {
  season?: number
}

/** Query for `GET /record-timelines/batch` */
export interface RecordTimelinesBatchQuery {
  /** MLB team ids (backend caps count and sorts for cache keys) */
  teamIds: number[]
  season?: number
}

export interface RecordTimelinesBatchResponse {
  season: number
  timelines: RecordTimelineResponse[]
}

export interface PlayersCompareQuery {
  ids: string
  season?: number
  group?: 'hitting' | 'pitching'
}

export interface PlayerSearchHit {
  id: number
  fullName: string
  position?: string
  active: boolean
  primaryNumber?: string
}

export interface PlayersSearchResponse {
  query: string
  people: PlayerSearchHit[]
  truncated?: boolean
}

export interface PlayersSearchQuery {
  /** Search text (passed as MLB `names` query param) */
  names: string
}

export interface GameSummary {
  gamePk: number
  awayTeam: string
  homeTeam: string
  awayId: number
  homeId: number
  status: string
  awayScore: number
  homeScore: number
  officialDate?: string
}

export interface GamesForDateResponse {
  date: string
  games: GameSummary[]
}

export interface GamesForDateQuery {
  date: string
  teamId?: number
}
