/** Fixed slate date so Games does not depend on the runner's local "today". */
export const SMOKE_DATE = '2026-04-22';
export const SMOKE_GAME_PK = 662000;

export const standings = {
  season: 2026,
  divisions: [
    {
      divisionId: 201,
      divisionName: 'NL East',
      leagueId: 104,
      teams: [
        {
          teamId: 121,
          teamName: 'Mets',
          wins: 10,
          losses: 5,
          pct: '.667',
          gamesPlayed: 15,
          divisionRank: '1',
          gamesBack: '-',
          wildCardGamesBack: '-',
        },
        {
          teamId: 144,
          teamName: 'Braves',
          wins: 9,
          losses: 6,
          pct: '.600',
          gamesPlayed: 15,
          divisionRank: '2',
          gamesBack: '1.0',
          wildCardGamesBack: '-',
        },
      ],
    },
    {
      divisionId: 202,
      divisionName: 'NL Central',
      leagueId: 104,
      teams: [
        {
          teamId: 112,
          teamName: 'Cubs',
          wins: 9,
          losses: 6,
          pct: '.600',
          gamesPlayed: 15,
          divisionRank: '1',
          gamesBack: '-',
          wildCardGamesBack: '-',
        },
      ],
    },
  ],
};

export const teams = {
  teams: [
    {
      id: 121,
      name: 'Mets',
      abbreviation: 'NYM',
      teamName: 'New York Mets',
      leagueId: 104,
      leagueName: 'National League',
      divisionId: 201,
      divisionName: 'NL East',
      active: true,
    },
    {
      id: 144,
      name: 'Braves',
      abbreviation: 'ATL',
      teamName: 'Atlanta Braves',
      leagueId: 104,
      leagueName: 'National League',
      divisionId: 201,
      divisionName: 'NL East',
      active: true,
    },
    {
      id: 112,
      name: 'Cubs',
      abbreviation: 'CHC',
      teamName: 'Chicago Cubs',
      leagueId: 104,
      leagueName: 'National League',
      divisionId: 202,
      divisionName: 'NL Central',
      active: true,
    },
  ],
};

export const timelinesBatch = {
  season: 2026,
  timelines: [],
};

export const gamesForDate = {
  date: SMOKE_DATE,
  games: [
    {
      gamePk: SMOKE_GAME_PK,
      awayTeam: 'Away',
      homeTeam: 'Home',
      awayId: 121,
      homeId: 144,
      status: 'Final',
      awayScore: 3,
      homeScore: 2,
      officialDate: SMOKE_DATE,
    },
  ],
};

export const boxscore = {
  gamePk: SMOKE_GAME_PK,
  status: 'Final',
  away: {
    teamId: 121,
    teamName: 'Away',
    totals: { runs: 3, hits: 8, errors: 0 },
    batting: [],
    pitching: [
      {
        playerId: 2001,
        name: 'Casey Pitcher',
        ip: '6.0',
        h: 4,
        r: 2,
        er: 2,
        bb: 1,
        so: 6,
        hr: 0,
      },
    ],
  },
  home: {
    teamId: 144,
    teamName: 'Home',
    totals: { runs: 2, hits: 6, errors: 1 },
    batting: [],
    pitching: [],
  },
};

export const timeline = {
  gamePk: SMOKE_GAME_PK,
  status: 'Final',
  homeTeam: 'Home',
  awayTeam: 'Away',
  homeId: 144,
  awayId: 121,
  innings: [],
  homeTotal: 2,
  awayTotal: 3,
};

export const statcast = {
  gamePk: SMOKE_GAME_PK,
  battedBalls: [],
};

export const pitches = {
  gamePk: SMOKE_GAME_PK,
  pitches: [
    {
      plateX: -0.2,
      plateZ: 2.1,
      pitchName: '4-Seam Fastball',
      pitchType: 'FF',
      pitcher: 2001,
      releaseSpeed: 94.2,
    },
    {
      plateX: 0.4,
      plateZ: 3.0,
      pitchName: 'Slider',
      pitchType: 'SL',
      pitcher: 2001,
      releaseSpeed: 87.0,
    },
    {
      plateX: -0.5,
      plateZ: 1.8,
      pitchName: '4-Seam Fastball',
      pitchType: 'FF',
      pitcher: 2001,
      releaseSpeed: 95.1,
    },
  ],
};

export const leadersPitchingWins = {
  season: 2024,
  group: 'pitching',
  category: 'wins',
  limit: 10,
  categories: ['earnedRunAverage', 'wins', 'strikeouts'],
  leaders: [
    {
      rank: 1,
      value: '18',
      playerId: 1,
      playerName: 'Smoke Ace',
      teamId: 121,
      teamName: 'New York Mets',
      leagueName: 'NL',
    },
  ],
};

export const seasonStats = {
  season: 2026,
  teamId: 121,
  hitting: {
    gamesPlayed: 15,
    runs: 75,
    runsPerGame: 5,
    doubles: 28,
    stolenBases: 12,
  },
  pitching: { gamesPlayed: 15, runsAllowed: 60, runsAllowedPerGame: 4 },
  venueSplits: {
    home: { games: 0, wins: 0, losses: 0, runsScored: 0, runsAllowed: 0 },
    away: { games: 0, wins: 0, losses: 0, runsScored: 0, runsAllowed: 0 },
  },
};

export const recordTimeline = {
  teamId: 121,
  season: 2026,
  points: [],
  finishedGames: 0,
};
