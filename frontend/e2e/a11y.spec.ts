import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { test } from '@playwright/test';
import type { AxeResults } from 'axe-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = path.join(__dirname, '..', 'a11y-report.json');

// Static routes only -- these run against the real deployed preview + live API,
// so dynamic routes needing a specific gamePk/team pairing that exists in live
// data (game detail, player compare) are out of scope for this scan.
const ROUTES = ['/', '/leaders', '/games', '/teams', '/standings'];

type RoutePageResult = { route: string; url: string; violations: AxeResults['violations'] };

const results: RoutePageResult[] = [];

for (const route of ROUTES) {
  test(`axe scan: ${route}`, async ({ page }) => {
    await page.goto(route);
    const axeResults = await new AxeBuilder({ page }).analyze();
    results.push({ route, url: page.url(), violations: axeResults.violations });
  });
}

test.afterAll(() => {
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ results }, null, 2));
});
