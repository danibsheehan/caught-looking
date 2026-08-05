import { defineConfig, devices } from '@playwright/test';

const previewHost = '127.0.0.1';
const previewPort = 4173;
const baseURL = `http://${previewHost}:${previewPort}`;

/**
 * Chromium smoke against a production build (`vite build` + `vite preview`).
 * API calls are fulfilled in-process via `page.route` (see `e2e/helpers/stubApi.ts`).
 * Leave `VITE_API_BASE` unset so the SPA uses `/api`.
 */
export default defineConfig({
  testDir: './e2e',
  /** Stub smoke only; contract path uses playwright.contract.config.ts. */
  testIgnore: '**/contract.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host ${previewHost} --port ${previewPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
