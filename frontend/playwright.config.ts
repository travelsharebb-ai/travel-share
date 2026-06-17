import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  webServer: {
    command: 'npm run preview -- --port 5174 --host 127.0.0.1',
    port: 5174,
    reuseExistingServer: true,
    timeout: 120000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5174',
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
