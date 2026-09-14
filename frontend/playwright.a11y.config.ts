import { defineConfig, devices } from '@playwright/test';

/**
 * Axe-core scan of the already-deployed Cloudflare Pages PR preview.
 * No webServer/build here -- PREVIEW_URL must point at a live deployment
 * (see the `a11y` job in .github/workflows/pages-preview.yml).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/a11y.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PREVIEW_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-a11y',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
