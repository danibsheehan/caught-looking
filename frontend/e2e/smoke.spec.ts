import { expect, test } from '@playwright/test';
import { SMOKE_DATE } from './fixtures/smokeApi';
import { stubApi } from './helpers/stubApi';

test.beforeEach(async ({ page }) => {
  await stubApi(page);
});

test('Standings → Games → box score → Statcast spray', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Standings' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Games' })
    .click();

  await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();

  await page.locator('input[type="date"]').fill(SMOKE_DATE);

  await expect(page.getByRole('heading', { level: 2, name: 'Games on this day' })).toBeVisible();
  await page.getByRole('link', { name: /Away @ Home/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Box score' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Batted balls' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Spray (field view)' })).toBeVisible();
});
