import { defineConfig, devices } from '@playwright/test';

const previewHost = '127.0.0.1';
const previewPort = 4174;
const baseURL = `http://${previewHost}:${previewPort}`;

/**
 * Contract-aware Chromium smoke: real Go API + fixture MLB/Savant upstream.
 * Does not use page.route stubs. See e2e/scripts/run-contract-stack.sh.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/contract.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-contract',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bash e2e/scripts/run-contract-stack.sh',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
