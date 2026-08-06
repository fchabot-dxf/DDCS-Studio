import { defineConfig } from '@playwright/test';

// Env-overridable port (default 3211 unchanged) so a second checkout can run its suite BESIDE the main repo's
// (whose mem-server owns 3211): DDCS_TEST_PORT=3213 npx playwright test …  Specs reach it via use.baseURL.
const PORT = parseInt(process.env.DDCS_TEST_PORT || '', 10) || 3211;

export default defineConfig({
  testDir: 'tests',
  // tests/node/ is the BROWSER-FREE tier (`npm run test:node`) — the same assertions with no app boot. Playwright
  // would otherwise collect its *.test.mjs files and run them a second time, which is the opposite of the point.
  // t1587 — this exclusion means `npx playwright test` / `npm run test:e2e` alone SKIPS these tests silently; the
  // merge gate must run `npm test` (both tiers, fails if either does), never `test:e2e` on its own.
  testIgnore: ['node/**'],
  workers: 4,  // t836 — the mem-server killed the fs-contention (was 21min@w2 on http-server); w4 is the RELIABLY-GREEN point (~11.5min, measured 3x consecutive 0-fail). w6 shaved ~1min but CPU-contended → flaked ~1 load-sensitive test/run (perf/race/boot), not server-fixable.
  timeout: 60_000,   // t1197 — per-test cap; lenient (a slow load-flake gets more time, never turns a passing test red)
  expect: { toHaveTimeout: 5000 },
  use: {
    headless: true,
    viewport: { width: 412, height: 915 },
    actionTimeout: 5_000,
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `node tests/support/mem-server.cjs ${PORT}`,   // t832 — in-memory static server (preloads web/; microsecond serves for the 346-module boot storm; NO bundle — serves the raw modules that ship)
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
