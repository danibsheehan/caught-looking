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

/** GET /games/{gamePk}/statcast — batted-ball tracking rows (cached on the server). */
export interface StatcastBattedBall {
  launchSpeed?: number
  launchAngle?: number
  /** Savant Search grid `hc_x` (not literal field feet until converted for spray charts). */
  hcX?: number
  /** Savant Search grid `hc_y` (increases toward backstop; not literal depth in feet). */
  hcY?: number
  batter: number
  pitcher: number
  playerName: string
  events?: string
  /** "Top" (away batting) or "Bottom" (home batting); from `inning_topbot`. */
  inningHalf?: string
}

export interface GameStatcastResponse {
  gamePk: number
  /** MLB Stats API venue id from schedule (for park-shaped outline). */
  venueId?: number
  venueName?: string
  battedBalls: StatcastBattedBall[]
}

/** GET /games/{gamePk}/statcast/pitches — pitch-level rows (plate location, type; cached on the server). */
export interface StatcastPitch {
  /** Horizontal location at plate (feet), catcher’s view — source `plate_x`. */
  plateX: number
  /** Vertical location at plate (feet) — source `plate_z`. */
  plateZ: number
  pitchName?: string
  pitcher: number
  releaseSpeed?: number
  /** "Top" or "Bottom"; from `inning_topbot`. */
  inningHalf?: string
  /** Top of batter strike zone (feet), source `sz_top`. */
  szTop?: number
  /** Bottom of batter strike zone (feet), source `sz_bot`. */
  szBot?: number
}

export interface GameStatcastPitchesResponse {
  gamePk: number
  pitches: StatcastPitch[]
}

export interface PlayerStatSnapshot {
  id: number
  fullName: string
  group: string
  /** Season split fields from GET /players/compare (see backend players_compare). */
  stats: Record<string, number>
}

export interface PlayersRadarResponse {
  /** `season` — single-year stats; `career` — MLB career regular-season (gameType R) aggregate */
  scope: 'season' | 'career'
  /** Year when scope is season; 0 when career */
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
  /** Single season vs career aggregate (backend ignores season when career). */
  scope?: 'season' | 'career'
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

/** GET /players/{id}/current-team — MLB `hydrate=currentTeam` */
export interface PlayerCurrentTeamResponse {
  playerId: number
  /** 0 if free agent / not assigned in API */
  teamId: number
}

export interface LeagueSeasonBaselineResponse {
  season: number
  group: string
  ops: number
  era: number
}

export interface SeasonPoint {
  season: number
  value: number
}

export interface YearSeriesPlayer {
  id: number
  fullName: string
  points: SeasonPoint[]
}

/** Year-by-year career arc metric (GET /players/compare/year-by-year). */
export type YearByYearMetric =
  | 'ops'
  | 'avg'
  | 'obp'
  | 'slg'
  | 'woba'
  | 'era'
  | 'whip'
  | 'k9'
  | 'bb9'
  | 'fip'

export interface PlayersYearByYearResponse {
  group: string
  metric: YearByYearMetric
  players: YearSeriesPlayer[]
  leagueBySeason: Record<string, number>
}

export interface GamePoint {
  date: string
  gamePk: number
  value: number
}

export interface GameLogPlayer {
  id: number
  fullName: string
  games: GamePoint[]
}

export interface PlayersGameLogResponse {
  season: number
  group: string
  metric: 'ops' | 'era'
  limit: number
  players: GameLogPlayer[]
  leagueBaseline: number
}

export interface PlayersCompareYearByYearQuery {
  ids: string
  group?: 'hitting' | 'pitching'
  metric?: YearByYearMetric
}

export interface PlayersCompareGameLogQuery {
  ids: string
  season?: number
  group?: 'hitting' | 'pitching'
  limit?: number
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
