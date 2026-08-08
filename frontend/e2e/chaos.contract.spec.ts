import { expect, test, type APIRequestContext } from '@playwright/test';

/** Keep in sync with backend/internal/e2eupstream and run-contract-stack defaults. */
const CONTRACT_DATE = '2026-04-22';
const CONTRACT_GAME_PK = '662000';
const UPSTREAM_URL = process.env.E2E_UPSTREAM_URL ?? 'http://127.0.0.1:18082';

type ChaosConfig = {
  mode: 'none' | '429' | '5xx' | 'slow';
  paths: string[];
  slowMs?: number;
};

async function setChaos(request: APIRequestContext, cfg: ChaosConfig): Promise<void> {
  const res = await request.put(`${UPSTREAM_URL}/_chaos`, {
    data: {
      mode: cfg.mode,
      paths: cfg.paths,
      slowMs: cfg.slowMs ?? 1500,
    },
  });
  expect(res.ok(), `setChaos failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

async function clearChaos(request: APIRequestContext): Promise<void> {
  await setChaos(request, { mode: 'none', paths: [] });
}

test.describe('e2e-upstream chaos (contract stack)', () => {
  test.afterEach(async ({ request }) => {
    await clearChaos(request);
  });

  test('Statcast CSV 5xx: box score loads; Statcast panels show bad gateway', async ({
    page,
    request,
  }) => {
    await setChaos(request, { mode: '5xx', paths: ['/statcast_search/csv'] });

    await page.goto(`/games/${CONTRACT_GAME_PK}?date=${CONTRACT_DATE}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Box score' })).toBeVisible();
    // Boxscore/linescore still succeed — independent of Savant.
    await expect(page.getByText('Away Batter')).toBeVisible({ timeout: 15_000 });

    const gatewayAlerts = page.getByRole('alert').filter({ hasText: /bad gateway \(request /i });
    // Spray + pitch location both use Savant CSV, so both panels degrade.
    await expect(gatewayAlerts.first()).toBeVisible({ timeout: 15_000 });
    await expect(gatewayAlerts).toHaveCount(2);
    await expect(page.getByRole('heading', { level: 3, name: 'Spray (field view)' })).toHaveCount(
      0,
    );
  });

  test('Standings 429: SPA surfaces gateway error with request id', async ({ page, request }) => {
    await setChaos(request, { mode: '429', paths: ['/standings'] });

    await page.goto('/standings');

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText(/bad gateway/i);
    await expect(alert).toContainText(/request /i);
  });

  test('Standings slow: page still loads after upstream delay', async ({ page, request }) => {
    await setChaos(request, { mode: 'slow', paths: ['/standings'], slowMs: 1200 });

    await page.goto('/standings');

    await expect(page.getByRole('heading', { level: 1, name: 'Standings' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(/Selected division:\s*East/i)).toBeVisible({ timeout: 20_000 });
  });
});
