import { defineConfig, devices } from '@playwright/test';

// `vp run db:up` first (and create the notalah_test_81 database once). globalSetup migrates and reseeds that database,
// and the dev server is started against it, so a dev server already running on 5173/4000 is an error, not reused.
const E2E_DB =
  process.env.E2E_DATABASE_URL ?? 'postgres://notalah:notalah@127.0.0.1:5433/notalah_test_81?sslmode=disable';
export const E2E_ENV = { DATABASE_URL: E2E_DB, TEST_DATABASE_URL: E2E_DB };

export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.ts',
  outputDir: '../test-results',
  reporter: [['list'], ['html', { outputFolder: '../playwright-report', open: 'never' }]],
  workers: 1,
  retries: 0,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    // AI stub (R28): outline replies only, so rewrite, shorten and quiz are not covered by it.
    {
      command: 'node e2e/stub-ai/server.mjs',
      cwd: '..',
      url: 'http://127.0.0.1:4010/health',
      reuseExistingServer: false,
    },
    {
      command: 'vp run dev',
      cwd: '..',
      // Through the Vite proxy: answers 200 only when Vite and the API on 4000 are both up.
      url: 'http://localhost:5173/api/health',
      reuseExistingServer: false,
      env: {
        ...E2E_ENV,
        AI_BASE_URL: 'http://127.0.0.1:4010',
        AI_API_KEY: 'stub',
        AI_MODEL: 'stub',
      },
    },
  ],
});
