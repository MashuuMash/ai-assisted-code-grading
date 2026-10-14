import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  use: {
    actionTimeout: 15_000,
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3001',
    viewport: { width: 1600, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3001 --strictPort',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: false,
    env: { VITE_API_TARGET: process.env.E2E_API_TARGET || 'http://127.0.0.1:8001' },
  },
});
