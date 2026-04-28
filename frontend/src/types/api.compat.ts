import type { components, operations } from './api.generated'

type QueryOf<T extends { parameters: { query?: unknown } }> = T['parameters']['query']
export type Team = components['schemas']['Team']
export type StandingTeam = components['schemas']['StandingTeam']
export type StandingDivision = components['schemas']['StandingDivision']
export type RecordPoint = components['schemas']['RecordPoint']
export type GameSummary = components['schemas']['GameSummary']
export type PlayerSearchHit = components['schemas']['PlayerSearchHit']
export type GameTimelineResponse = components['schemas']['GameTimelineResponse']
export type LeagueSeasonBaselineResponse = components['schemas']['LeagueSeasonBaselineResponse']
export type PlayerCurrentTeamResponse = components['schemas']['PlayerCurrentTeamResponse']
export type TeamsResponse = components['schemas']['TeamsResponse']
export type StandingsResponse = components['schemas']['StandingsResponse']
export type RecordTimelineResponse = components['schemas']['RecordTimelineResponse']
export type RecordTimelinesBatchResponse = components['schemas']['RecordTimelinesBatchResponse']
export type GamesForDateResponse = components['schemas']['GamesForDateResponse']
export type PlayersSearchResponse = components['schemas']['PlayersSearchResponse']
export type YearByYearMetric = components['schemas']['PlayersYearByYearResponse']['metric']
export type GameBoxscoreResponse = components['schemas']['GameBoxscoreResponse']
export type GameStatcastResponse = components['schemas']['GameStatcastResponse']
export type GameStatcastPitchesResponse = components['schemas']['GameStatcastPitchesResponse']
export type TeamGameTotals = components['schemas']['TeamGameTotals']
export type BatterLine = components['schemas']['BatterLine']
export type PitcherLine = components['schemas']['PitcherLine']
export type TeamBoxSide = components['schemas']['TeamBoxSide']
export type StatcastPitch = components['schemas']['StatcastPitch']
export type StatcastBattedBall = components['schemas']['StatcastBattedBall']
export type TeamSeasonStatsResponse = components['schemas']['TeamSeasonStatsResponse']
export type TeamVenueSplitLine = components['schemas']['TeamVenueSplitLine']
export type TeamVenueSplits = components['schemas']['TeamVenueSplits']
export type TeamHittingLine = components['schemas']['TeamHittingLine']
export type TeamPitchingLine = components['schemas']['TeamPitchingLine']
export type PlayersRadarResponse = components['schemas']['PlayersRadarResponse']
export type PlayerStatSnapshot = components['schemas']['PlayerStatSnapshot']
export type PlayersYearByYearResponse = components['schemas']['PlayersYearByYearResponse']
export type YearSeriesPlayer = components['schemas']['YearSeriesPlayer']
export type SeasonPoint = components['schemas']['SeasonPoint']
export type PlayersGameLogResponse = components['schemas']['PlayersGameLogResponse']
export type GameLogPlayer = components['schemas']['GameLogPlayer']
export type GamePoint = components['schemas']['GamePoint']
export type PlayersPlatoonResponse = components['schemas']['PlayersPlatoonResponse']
export type PlatoonPlayer = components['schemas']['PlatoonPlayer']
export type PlatoonSplitRow = components['schemas']['PlatoonSplitRow']

// Source query types from generated operations.
export type StandingsQuery = QueryOf<operations['getStandings']>
export type TeamsQuery = QueryOf<operations['listTeams']>
export type TeamSeasonStatsQuery = QueryOf<operations['getTeamSeasonStats']>
export type RecordTimelineQuery = QueryOf<operations['getRecordTimeline']>
export type RecordTimelinesBatchQuery = {
  teamIds: number[]
  season?: number
}
export type GamesForDateQuery = QueryOf<operations['getGamesForDate']>
export type PlayersSearchQuery = QueryOf<operations['searchPlayers']>
export type PlayersCompareQuery = QueryOf<operations['comparePlayers']>
export type PlayersCompareYearByYearQuery = QueryOf<operations['comparePlayersYearByYear']>
export type PlayersCompareGameLogQuery = QueryOf<operations['comparePlayersGameLog']>
export type PlayersComparePlatoonQuery = QueryOf<operations['comparePlayersPlatoon']>
