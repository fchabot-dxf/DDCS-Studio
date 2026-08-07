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
  // t1607 — CI needs an HTML report to upload as a diagnosable artifact on a red run; local runs keep the
  // terse 'list' output unchanged (this only takes effect under GitHub Actions' own CI=true).
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  workers: 6,  // t1593 (2026-08-06) — re-measured on the i7-13700F (16c/24t/32GB): w4=1158s/73fail, w6=975s/73fail (same set, ±2 within
               // the existing flake class), w8=897s/82fail (+10 NEW beyond baseline, only 1 healed — a real contention ceiling; backed
               // off per the "new failures → back off one step" rule, so w12 was not run). The t836 baseline this replaces was itself
               // contaminated by the (now-fixed) formBindings bug's deterministic failures being misread as load sensitivity.
               // NOTE: the 73-count baseline itself is NOT zero — it's a separate, pre-existing mouse/hover-event class (drag/canvas
               // tests) confirmed present on main HEAD too (0 flaky across retries); unrelated to worker count, not investigated here.
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
