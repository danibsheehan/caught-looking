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
  /** Optional fields from MLB standings payload */
  runsScored?: number
  runsAllowed?: number
  runDifferential?: number
  streak?: string
  homeWins?: number
  homeLosses?: number
  awayWins?: number
  awayLosses?: number
  lastTenWins?: number
  lastTenLosses?: number
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

export interface TeamGameTotals {
  runs: number
  hits: number
  errors: number
  leftOnBase?: number
  doubles?: number
  triples?: number
  homeRuns?: number
}

export interface BatterLine {
  playerId: number
  name: string
  pos: string
  ab: number
  r: number
  h: number
  doubles: number
  triples: number
  hr: number
  rbi: number
  bb: number
  so: number
}

export interface PitcherLine {
  playerId: number
  name: string
  ip: string
  h: number
  r: number
  er: number
  bb: number
  so: number
  hr: number
}

export interface TeamBoxSide {
  teamId: number
  teamName: string
  totals: TeamGameTotals
  batting: BatterLine[]
  pitching: PitcherLine[]
}

export interface GameBoxscoreResponse {
  gamePk: number
  away: TeamBoxSide
  home: TeamBoxSide
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

/** Query for `GET /teams/{teamId}/season-stats` */
export interface TeamSeasonStatsQuery {
  season?: number
}

/** Team hitting & pitching season aggregates */
export interface TeamSeasonStatsResponse {
  season: number
  teamId: number
  hitting: TeamHittingLine
  pitching: TeamPitchingLine
}

export interface TeamHittingLine {
  gamesPlayed: number
  runs: number
  runsPerGame: number
  ops?: number
  obp?: number
  slg?: number
  avg?: number
}

export interface TeamPitchingLine {
  gamesPlayed: number
  runsAllowed: number
  runsAllowedPerGame: number
  era?: number
  whip?: number
  k9?: number
  bb9?: number
}
