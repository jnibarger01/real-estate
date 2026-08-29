import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 3310);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    httpCredentials: {
      username: process.env.DASHBOARD_AUTH_USER || 'e2e-user',
      password: process.env.DASHBOARD_AUTH_PASSWORD || 'e2e-pass',
    },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: process.env.CI
        ? { ...devices['Desktop Chrome'] }
        : { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'node dist/server.js',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      DASHBOARD_AUTH_USER: process.env.DASHBOARD_AUTH_USER || 'e2e-user',
      DASHBOARD_AUTH_PASSWORD: process.env.DASHBOARD_AUTH_PASSWORD || 'e2e-pass',
    },
  },
});
