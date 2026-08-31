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
  // t1607 — CI needs an HTML report to upload as a diagnosable artifact on a red run; kept exactly as before.
  // t1724 — the JSON reporter runs UNCONDITIONALLY (local + CI alike): scripts/test-all.cjs reads its
  // `stats.flaky`/`stats.unexpected` back out and prints them as the gate's own named health metric, so
  // "how many flaked this run" is a number the gate states, not text a human has to notice in scrollback.
  // t2407 (BACKLOG #54) — `list` REMOVED off-CI: it printed one line per test (~2900 lines, ~25-30k chars)
  // straight into the caller's own captured output, discarded once the run ends. Replaced with
  // progressReporter.mjs, which follows the JSON reporter's own "unconditional" precedent (its FILE writes —
  // test-results/progress.{md,html,json} — run local+CI alike) but keeps its own console output CI-silent
  // (CI already has `dot`+`html`; doubling that up was never this entry's complaint). See the reporter's own
  // header for the full surface/stdout-shape reasoning.
  reporter: [...(process.env.CI ? [['dot'], ['html', { open: 'never' }]] : []), ['./tests/support/progressReporter.mjs'], ['json', { outputFile: 'test-results/summary.json' }]],
  workers: 4,  // t2443 (2026-08-31) — RE-MEASURED, replacing t1593's own w6 pick: on THIS SAME i7-13700F (16c/24t/32GB), w6 now
               // comes back 46 FAILED (spanning totally unrelated domains — alignment drag physics, ATC rendering, Blocks find,
               // add-operation G-code identity — the signature of resource starvation, not a logic defect), reproduced IDENTICALLY
               // across two separate clean runs (retries:2 below already absorbs ordinary one-off contention, so 46 tests failing
               // ALL THREE attempts, twice, is a systematic ceiling, not noise). w4 on the SAME machine, same moment: 0 FAILED
               // (2994 passed, 11 flaky, 26 skipped) — a complete collapse, not just an improvement. Confirmed via A/B (the 46 also
               // reproduce at HEAD before that turn's own unrelated change existed) and isolated spot-checks (25 of the 46 ran 100%
               // clean alone) before trusting the worker-count theory over "just flaky code." Peak measured during the w4 run: ~5.3GB
               // across 33 Chrome processes + ~3.1GB across 24 node processes.
               // WHY THE OLD NUMBER WENT STALE: t1593's own w6=975s/73fail measurement is 3.5 weeks and ~600 tests of suite growth
               // old, taken on a QUIETER machine. This box's own ORDINARY baseline (owner-confirmed no other agent running) now
               // carries ~28 Chrome + ~17 node processes, VS Code, and two concurrent Claude Code seats even before Playwright starts
               // a single worker — six Chromium-driving workers on top of that oversubscribes it. See context/VERIFICATION.md for the
               // standing note: this full suite needs re-measuring again if the machine's own ordinary baseline shifts meaningfully,
               // the same way this measurement replaced t1593's.
               // t1593 (2026-08-06, superseded): w4=1158s/73fail, w6=975s/73fail, w8=897s/82fail (+10 new, only 1 healed — a real
               // ceiling, backed off). The t836 baseline t1593 itself replaced was contaminated by a since-fixed formBindings bug.
               // NOTE (unrelated to worker count, not re-investigated here): a separate, pre-existing mouse/hover-event flake class
               // (drag/canvas tests) was already present on main HEAD independent of this number — see t1593's own original note.
  // t1724 — retries live HERE, not on individual specs. t1718 declared `test.describe.configure({retries:2})` on
  // 5 specs measured flaky under this SAME worker=6 contention; t1719's next gate run showed 3 DIFFERENT specs
  // starved instead (names that hadn't failed the run before) — the contention-starved population shifts run to
  // run, so a fixed per-spec list goes stale immediately and becomes exactly the "14 failed, all churn" folklore
  // this whole arc exists to kill. Contention is a property of the CONFIG (`workers` above), not of any one
  // spec, so the mitigation is declared at the same level: every test gets up to 2 retries, healing a genuine
  // one-off contention stall without masking a real regression (a deterministic defect fails every retry too,
  // and still fails the gate). The health metric this act asks for — the FLAKY COUNT, read at every release
  // instead of a per-spec name list — is surfaced by the JSON reporter below + scripts/test-all.cjs.
  retries: 2,
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
    // t1666 — was `!process.env.CI` (reuse locally, fresh in CI). The mem-server PRELOADS every file ONCE at
    // startup and never re-reads them, so a leftover process from an earlier (aborted, Ctrl-C'd, force-killed)
    // run silently served a STALE snapshot to the next `npx playwright test` invocation — three real false
    // negatives in one session, each caught only by a human's suspicion (a non-vacuity check that stayed green
    // against a no-op fix; a probe that read an old value after the file was already corrected on disk). FALSE
    // unconditionally makes staleness IMPOSSIBLE rather than merely unlikely: Playwright now REFUSES to start
    // ("port already used") the instant it would have reused a stale process, instead of silently trusting it.
    // Costs ~57ms per invocation (measured) to always cold-start the server — a once-per-run cost, not a
    // per-test one. Matches CI's own setting, which never had this bug.
    reuseExistingServer: false,
  },
});
