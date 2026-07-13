import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  workers: 4,   // t836 — the mem-server killed the fs-contention (was 21min@w2 on http-server); w4 is the RELIABLY-GREEN point (~11.5min, measured 3x consecutive 0-fail). w6 shaved ~1min but CPU-contended → flaked ~1 load-sensitive test/run (perf/race/boot), not server-fixable.
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
