import { expect, test } from '@playwright/test';
import { SMOKE_DATE, SMOKE_GAME_PK } from './fixtures/smokeApi';
import { stubApi } from './helpers/stubApi';

test.beforeEach(async ({ page }) => {
  await stubApi(page);
});

test('deep link restores Leaders filters from the URL', async ({ page }) => {
  await page.goto('/leaders?group=pitching&category=wins&season=2024');

  await expect(page.getByRole('heading', { level: 1, name: 'Leaders' })).toBeVisible();
  await expect(page.getByLabel('Stat group')).toHaveValue('pitching');
  await expect(page.getByLabel('Category')).toHaveValue('wins');
  await expect(page.getByLabel('Season')).toHaveValue('2024');
  await expect(page.getByText('Smoke Ace')).toBeVisible();
});

test('deep link restores Games slate date and team', async ({ page }) => {
  await page.goto(`/games?date=${SMOKE_DATE}&team=121`);

  await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();
  await expect(page.locator('input[type="date"]')).toHaveValue(SMOKE_DATE);
  await expect(page.getByLabel('Team (optional)')).toHaveValue('121');
  await expect(page.getByRole('link', { name: /Away @ Home/ })).toBeVisible();
});

test('deep link restores Teams club, season, and deep tab', async ({ page }) => {
  await page.goto('/teams?team=121&season=2026&tab=deep');

  await expect(page.getByRole('heading', { level: 1, name: 'Teams' })).toBeVisible();
  await expect(page.getByLabel('Club')).toHaveValue('121');
  await expect(page.getByLabel('Season')).toHaveValue('2026');
  await expect(page.getByRole('tab', { name: 'Deep dive' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('Game Detail density toggle switches pitch plot mode', async ({ page }) => {
  await page.goto(`/games/${SMOKE_GAME_PK}?date=${SMOKE_DATE}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Box score' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Pitch location' })).toBeVisible();

  const density = page.getByRole('button', { name: /^Density$/i });
  const locations = page.getByRole('button', { name: /^Locations$/i });
  await expect(locations).toHaveAttribute('aria-pressed', 'true');
  await expect(density).toHaveAttribute('aria-pressed', 'false');

  await density.click();
  await expect(density).toHaveAttribute('aria-pressed', 'true');
  await expect(locations).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Pitch type')).toBeVisible();
  await expect(
    page.getByRole('table', { name: /Pitch density map for Casey Pitcher/i }),
  ).toBeVisible();
});
