import type { Page, Route } from '@playwright/test';
import {
  boxscore,
  gamesForDate,
  leadersPitchingWins,
  pitches,
  recordTimeline,
  seasonStats,
  standings,
  statcast,
  teams,
  timeline,
  timelinesBatch,
} from '../fixtures/smokeApi';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Fulfill `/api/**` on the preview origin so smoke tests never hit the Go API or MLB.
 */
export async function stubApi(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const { pathname, searchParams } = new URL(route.request().url());
    const path = pathname.replace(/^\/api/, '') || '/';

    if (path === '/standings') {
      return json(route, standings);
    }
    if (path === '/teams') {
      return json(route, teams);
    }
    if (path === '/leaders') {
      if (searchParams.get('group') === 'pitching' && searchParams.get('category') === 'wins') {
        return json(route, leadersPitchingWins);
      }
      return json(route, {
        ...leadersPitchingWins,
        group: searchParams.get('group') ?? 'hitting',
        category: searchParams.get('category') ?? 'homeRuns',
        season: Number(searchParams.get('season')) || 2026,
        leaders: [],
        categories:
          searchParams.get('group') === 'pitching'
            ? leadersPitchingWins.categories
            : ['homeRuns', 'battingAverage', 'hits'],
      });
    }
    if (/^\/teams\/\d+\/season-stats$/.test(path)) {
      return json(route, seasonStats);
    }
    if (/^\/teams\/\d+\/record-timeline$/.test(path)) {
      return json(route, recordTimeline);
    }
    if (path.startsWith('/record-timelines/batch')) {
      return json(route, timelinesBatch);
    }
    if (path.startsWith('/games/for-date')) {
      return json(route, gamesForDate);
    }
    if (/^\/games\/\d+\/boxscore$/.test(path)) {
      return json(route, boxscore);
    }
    if (/^\/games\/\d+\/timeline$/.test(path)) {
      return json(route, timeline);
    }
    if (/^\/games\/\d+\/statcast\/pitches$/.test(path)) {
      return json(route, pitches);
    }
    if (/^\/games\/\d+\/statcast$/.test(path)) {
      return json(route, statcast);
    }

    return json(route, { error: `unhandled stub: ${path}` }, 404);
  });
}
