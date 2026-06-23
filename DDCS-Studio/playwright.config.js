import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  expect: { toHaveTimeout: 5000 },
  use: {
    headless: true,
    viewport: { width: 412, height: 915 },
    actionTimeout: 5_000,
  },
  webServer: {
    command: 'npx http-server ./web -p 3211 --silent',
    port: 3211,
    reuseExistingServer: !process.env.CI,
  },
});
