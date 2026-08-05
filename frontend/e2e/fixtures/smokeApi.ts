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
    pitching: [],
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
  pitches: [],
};
