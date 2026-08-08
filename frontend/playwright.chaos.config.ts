import { defineConfig, devices } from '@playwright/test';

/**
 * Chaos contract path: dedicated ports so the API cache stays cold (shared
 * contract stack would otherwise serve warm hits and skip upstream chaos).
 * Fixture upstream exposes PUT /_chaos — see backend/internal/e2eupstream.
 */
const previewHost = '127.0.0.1';
const previewPort = 4175;
const upstreamURL = 'http://127.0.0.1:18082';
const baseURL = `http://${previewHost}:${previewPort}`;

process.env.E2E_UPSTREAM_URL ??= upstreamURL;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/chaos.contract.spec.ts',
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
      name: 'chromium-chaos-contract',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bash e2e/scripts/run-contract-stack.sh',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ...process.env,
      E2E_UPSTREAM_ADDR: ':18082',
      E2E_API_ADDR: ':18083',
      E2E_PREVIEW_HOST: previewHost,
      E2E_PREVIEW_PORT: String(previewPort),
      E2E_UPSTREAM_URL: upstreamURL,
    },
  },
});
