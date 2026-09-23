import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.MOCK_FAMILY_ADMIN_URL ?? 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx tsx src/mock-admin/server.ts',
    url: 'http://127.0.0.1:3100/health',
    reuseExistingServer: true,
    timeout: 30000,
  },
})
