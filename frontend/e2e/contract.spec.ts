import { expect, test } from '@playwright/test';

/** Keep in sync with backend/internal/e2eupstream ContractDate / ContractGamePk. */
const CONTRACT_DATE = '2026-04-22';

function isStandingsApiResponse(url: string): boolean {
  try {
    return new URL(url).pathname === '/standings';
  } catch {
    return false;
  }
}

/**
 * One journey through the real Go API (fixture upstream) — not page.route stubs.
 * Proves SPA client ↔ handler JSON for the Standings → Games → Statcast demo arc.
 */
test('Standings → Games → box score → Statcast spray (contract)', async ({ page }) => {
  // Match API /standings only — not Vite chunks like /assets/standings-*.js
  const standingsRes = page.waitForResponse(
    (res) =>
      isStandingsApiResponse(res.url()) &&
      res.request().method() === 'GET' &&
      res.request().resourceType() === 'fetch' &&
      res.ok(),
  );

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Standings' })).toBeVisible();
  const standings = await standingsRes;
  expect(standings.status()).toBe(200);
  const standingsBody = await standings.json();
  expect(standingsBody).toMatchObject({
    season: expect.any(Number),
    divisions: expect.any(Array),
  });
  expect(standingsBody.divisions.length).toBeGreaterThan(0);

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Games' })
    .click();

  await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();

  await page.locator('input[type="date"]').fill(CONTRACT_DATE);

  await expect(page.getByRole('heading', { level: 2, name: 'Games on this day' })).toBeVisible();
  await page.getByRole('link', { name: /Away @ Home/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Box score' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Batted balls' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Spray (field view)' })).toBeVisible();

  await expect(page.getByRole('heading', { level: 2, name: 'Pitch location' })).toBeVisible();
  const density = page.getByRole('button', { name: /^Density$/i });
  await density.click();
  await expect(density).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Pitch type')).toBeVisible();
});
