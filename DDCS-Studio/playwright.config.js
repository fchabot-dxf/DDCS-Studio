import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  workers: 6,   // t832 — with the fs-contention gone (mem-server), the suite scales: w6 = ~10.4min/0-fail (was 21min@w2 on http-server). The measured sweet spot on this box.
  timeout: 30_000,
  expect: { toHaveTimeout: 5000 },
  use: {
    headless: true,
    viewport: { width: 412, height: 915 },
    actionTimeout: 5_000,
  },
  webServer: {
    command: 'node tests/support/mem-server.cjs 3211',   // t832 — in-memory static server (preloads web/; microsecond serves for the 346-module boot storm; NO bundle — serves the raw modules that ship)
    port: 3211,
    reuseExistingServer: !process.env.CI,
  },
});
