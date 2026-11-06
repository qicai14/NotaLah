import { defineConfig, devices } from '@playwright/test';

// Start the stack first with `vp run db:up && vp run server#uat:seed && vp run dev` (client 5173, server 4000);
// the webServer entry only reuses it locally and starts it in CI.
export default defineConfig({
  testDir: './specs',
  outputDir: '../test-results',
  reporter: [['list'], ['html', { outputFolder: '../playwright-report', open: 'never' }]],
  workers: 1,
  retries: 0,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'vp run dev',
    cwd: '..',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
