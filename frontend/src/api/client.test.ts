import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadClient(options?: { viteApiBase?: string | null }) {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (options && 'viteApiBase' in options) {
    const v = options.viteApiBase;
    if (v === null || v === undefined) {
      vi.stubEnv('VITE_API_BASE', '');
    } else {
      vi.stubEnv('VITE_API_BASE', v);
    }
  }
  vi.stubGlobal('fetch', fetchMock);
  return import('./client');
}

describe('api client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('API_BASE', () => {
    it('defaults to /api when VITE_API_BASE is empty', async () => {
      const { API_BASE } = await loadClient({ viteApiBase: '' });
      expect(API_BASE).toBe('/api');
    });

    it('defaults to /api when VITE_API_BASE is only whitespace', async () => {
      const { API_BASE } = await loadClient({ viteApiBase: '   \t  ' });
      expect(API_BASE).toBe('/api');
    });

    it('uses VITE_API_BASE and strips trailing slash', async () => {
      const { API_BASE } = await loadClient({
        viteApiBase: 'http://127.0.0.1:8080/',
      });
      expect(API_BASE).toBe('http://127.0.0.1:8080');
    });

    it('strips only one trailing slash (double slash leaves one slash)', async () => {
      const { API_BASE } = await loadClient({
        viteApiBase: 'http://127.0.0.1:8080//',
      });
      expect(API_BASE).toBe('http://127.0.0.1:8080/');
    });

    it('accepts numeric env as string (Vite may stringify)', async () => {
      const { API_BASE } = await loadClient({
        viteApiBase: '8080' as unknown as string,
      });
      expect(API_BASE).toBe('8080');
    });
  });

  describe('apiGet', () => {
    it('prefixes path with slash and joins API_BASE', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));
      const { apiGet, API_BASE } = await loadClient({ viteApiBase: '' });
      await apiGet('standings');
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/standings`);
    });

    it('throws with response body when present', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('missing resource', {
          status: 404,
          statusText: 'Not Found',
        }),
      );
      const { apiGet } = await loadClient({ viteApiBase: '' });
      await expect(apiGet('/x')).rejects.toThrow('missing resource');
    });

    it('throws status line when body is empty', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 502, statusText: 'Bad Gateway' }));
      const { apiGet } = await loadClient({ viteApiBase: '' });
      await expect(apiGet('/x')).rejects.toThrow('502 Bad Gateway');
    });

    it('throws JSON error.message from {"error":"..."} bodies', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'invalid season' }), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const { apiGet } = await loadClient({ viteApiBase: '' });
      await expect(apiGet('/x')).rejects.toThrow('invalid season');
    });

    it('attaches X-Request-ID on ApiError and includes it in message', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'bad gateway' }), {
          status: 502,
          statusText: 'Bad Gateway',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': 'req-abc-123',
          },
        }),
      );
      const { apiGet, ApiError } = await loadClient({ viteApiBase: '' });
      try {
        await apiGet('/x');
        expect.unreachable('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const err = e as InstanceType<typeof ApiError>;
        expect(err.status).toBe(502);
        expect(err.requestId).toBe('req-abc-123');
        expect(err.apiMessage).toBe('bad gateway');
        expect(err.message).toBe('bad gateway (request req-abc-123)');
      }
    });

    it('omits request id from ApiError when header is missing', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'too many requests' }), {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const { apiGet, ApiError } = await loadClient({ viteApiBase: '' });
      await expect(apiGet('/x')).rejects.toSatisfy((e: unknown) => {
        expect(e).toBeInstanceOf(ApiError);
        const err = e as InstanceType<typeof ApiError>;
        expect(err.requestId).toBeUndefined();
        expect(err.message).toBe('too many requests');
        return true;
      });
    });

    it('throws HTML error bodies as message text (non-JSON)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('<html><body>Gateway timeout</body></html>', {
          status: 504,
          statusText: 'Gateway Timeout',
          headers: { 'Content-Type': 'text/html' },
        }),
      );
      const { apiGet } = await loadClient({ viteApiBase: '' });
      await expect(apiGet('/x')).rejects.toThrow(/Gateway timeout/);
    });

    it('rejects when response is ok but body is not JSON', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('plain text ok', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/plain' },
        }),
      );
      const { apiGet } = await loadClient({ viteApiBase: '' });
      await expect(apiGet('/x')).rejects.toThrow();
    });

    it('uses leading slash on path when path already starts with /', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const { apiGet, API_BASE } = await loadClient({ viteApiBase: '' });
      await apiGet('/standings');
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/standings`);
    });

    it('forwards AbortSignal to fetch when provided', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const { apiGet, API_BASE } = await loadClient({ viteApiBase: '' });
      const ac = new AbortController();
      await apiGet('/foo', { signal: ac.signal });
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/foo`, {
        signal: ac.signal,
      });
    });
  });

  describe('fetch helpers — query strings and paths', () => {
    beforeEach(async () => {
      await loadClient({ viteApiBase: '' });
    });

    async function getClient() {
      return import('./client');
    }

    it('fetchStandings builds optional query', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ divisions: [] }));
      const { fetchStandings } = await getClient();
      await fetchStandings({
        season: 2024,
        leagueId: '103',
        standingsTypes: 'regularSeason',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/standings?season=2024&leagueId=103&standingsTypes=regularSeason',
      );
    });

    it('fetchLeaders builds query with all params set', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ leaders: [] }));
      const { fetchLeaders } = await getClient();
      await fetchLeaders({ season: 2024, group: 'hitting', category: 'homeRuns', limit: 10 });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/leaders?season=2024&group=hitting&category=homeRuns&limit=10',
      );
    });

    it('fetchLeaders omits all query params when none are set', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ leaders: [] }));
      const { fetchLeaders } = await getClient();
      await fetchLeaders();
      expect(fetchMock).toHaveBeenCalledWith('/api/leaders');
    });

    it('fetchTeams adds sportId when set', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ teams: [] }));
      const { fetchTeams } = await getClient();
      await fetchTeams({ sportId: '1' });
      expect(fetchMock).toHaveBeenCalledWith('/api/teams?sportId=1');
    });

    it('fetchTeamSeasonStats includes season in path and query', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      const { fetchTeamSeasonStats } = await getClient();
      await fetchTeamSeasonStats(147, { season: 2023 });
      expect(fetchMock).toHaveBeenCalledWith('/api/teams/147/season-stats?season=2023');
    });

    it('fetchRecordTimeline includes optional season', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      const { fetchRecordTimeline } = await getClient();
      await fetchRecordTimeline(147, { season: 2024 });
      expect(fetchMock).toHaveBeenCalledWith('/api/teams/147/record-timeline?season=2024');
    });

    it('fetchRecordTimelinesBatch filters non-positive ids and builds teamIds', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ timelines: [] }));
      const { fetchRecordTimelinesBatch } = await getClient();
      await fetchRecordTimelinesBatch({
        teamIds: [0, -1, 147, 121],
        season: 2024,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/record-timelines/batch?teamIds=147%2C121&season=2024',
      );
    });

    it('fetchRecordTimelinesBatch throws when no positive team ids', async () => {
      const { fetchRecordTimelinesBatch } = await getClient();
      await expect(fetchRecordTimelinesBatch({ teamIds: [0, -3] })).rejects.toThrow(
        'fetchRecordTimelinesBatch: teamIds must include at least one id',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fetchGameTimeline, fetchGameBoxscore, fetchGameStatcast encode game pk in path', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));
      fetchMock.mockResolvedValueOnce(jsonResponse({}));
      fetchMock.mockResolvedValueOnce(jsonResponse({}));
      fetchMock.mockResolvedValueOnce(jsonResponse({ pitches: [] }));
      const { fetchGameTimeline, fetchGameBoxscore, fetchGameStatcast, fetchGameStatcastPitches } =
        await getClient();
      await fetchGameTimeline(662000);
      await fetchGameBoxscore('662001');
      await fetchGameStatcast(662002);
      await fetchGameStatcastPitches(662003);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/games/662000/timeline');
      expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/games/662001/boxscore');
      expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/games/662002/statcast');
      expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/games/662003/statcast/pitches');
    });

    it('fetchGamesForDate requires date and optional teamId', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ games: [] }));
      const { fetchGamesForDate } = await getClient();
      await fetchGamesForDate({ date: '2024-07-04', teamId: 147 });
      expect(fetchMock).toHaveBeenCalledWith('/api/games/for-date?date=2024-07-04&teamId=147');
    });

    it('fetchGamesForDate omits teamId when not positive', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ games: [] }));
      const { fetchGamesForDate } = await getClient();
      await fetchGamesForDate({ date: '2024-07-04', teamId: 0 });
      expect(fetchMock).toHaveBeenCalledWith('/api/games/for-date?date=2024-07-04');
    });

    it('fetchPlayersCompare sets ids and optional params', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ players: [] }));
      const { fetchPlayersCompare } = await getClient();
      await fetchPlayersCompare({
        ids: '1,2',
        scope: 'career',
        season: 0,
        group: 'hitting',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/players/compare?ids=1%2C2&scope=career&season=0&group=hitting',
      );
    });

    it('fetchPlayerCurrentTeam uses player id in path', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      const { fetchPlayerCurrentTeam } = await getClient();
      await fetchPlayerCurrentTeam(12345);
      expect(fetchMock).toHaveBeenCalledWith('/api/players/12345/current-team');
    });

    it('fetchPlayersCurrentTeams builds ids query and rejects invalid args', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ players: [] }));
      const { fetchPlayersCurrentTeams } = await getClient();
      await fetchPlayersCurrentTeams(10, 20);
      expect(fetchMock).toHaveBeenCalledWith('/api/players/current-teams?ids=10%2C20');
      await expect(fetchPlayersCurrentTeams(1, 1)).rejects.toThrow(/must differ/);
    });

    it('fetchLeagueSeasonBaseline adds optional query', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      const { fetchLeagueSeasonBaseline } = await getClient();
      await fetchLeagueSeasonBaseline({ season: 2024, group: 'pitching' });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/league/season-baseline?season=2024&group=pitching',
      );
    });

    it('fetchPlayersCompareYearByYear builds query string', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      const { fetchPlayersCompareYearByYear } = await getClient();
      await fetchPlayersCompareYearByYear({ ids: '10,20', group: 'hitting' });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/players/compare/year-by-year?ids=10%2C20&group=hitting',
      );
    });

    it('fetchPlayersCompareYearByYear includes metric when set', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      const { fetchPlayersCompareYearByYear } = await getClient();
      await fetchPlayersCompareYearByYear({ ids: '10,20', group: 'hitting', metric: 'ops' });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/players/compare/year-by-year?ids=10%2C20&group=hitting&metric=ops',
      );
    });

    it('fetchPlayersCompareGameLog includes season, group, limit', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      const { fetchPlayersCompareGameLog } = await getClient();
      await fetchPlayersCompareGameLog({
        ids: '1,2',
        season: 2023,
        group: 'pitching',
        limit: 50,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/players/compare/game-log?ids=1%2C2&season=2023&group=pitching&limit=50',
      );
    });

    it('fetchPlayersComparePlatoon builds query string', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      const { fetchPlayersComparePlatoon } = await getClient();
      await fetchPlayersComparePlatoon({
        ids: '1,2',
        season: 2025,
        group: 'hitting',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/players/compare/platoon?ids=1%2C2&season=2025&group=hitting',
      );
    });

    it('fetchPlayersSearch sets names query', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ hits: [] }));
      const { fetchPlayersSearch } = await getClient();
      await fetchPlayersSearch({ names: 'Ohtani' });
      expect(fetchMock).toHaveBeenCalledWith('/api/players/search?names=Ohtani');
    });

    it('fetchPlayersSearch forwards optional AbortSignal', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ people: [] }));
      const { fetchPlayersSearch } = await getClient();
      const ac = new AbortController();
      await fetchPlayersSearch({ names: 'Ohtani' }, ac.signal);
      expect(fetchMock).toHaveBeenCalledWith('/api/players/search?names=Ohtani', {
        signal: ac.signal,
      });
    });
  });

  describe('custom API_BASE in requests', () => {
    it('uses configured origin for fetch URLs', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));
      const { fetchStandings, API_BASE } = await loadClient({
        viteApiBase: 'http://localhost:9999',
      });
      await fetchStandings();
      expect(API_BASE).toBe('http://localhost:9999');
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:9999/standings');
    });
  });
});
