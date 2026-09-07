# Test-suite tier-migration — the plan (tracked)

Moving pure-logic tests out of the browser (Playwright) tier into the fast node tier
(`tests/node/*.test.mjs`, harness `tests/node/support/harness.mjs`). Origin: a 6-agent read-only audit
(2026-09-06) of the ~3250-test suite. It is the ONE live suite — `npm test` runs `scripts/test-all.cjs`,
which runs BOTH tiers (`test:node` + `test:e2e`), so a test moving e2e→node still runs under `npm test`;
coverage is preserved by construction.

## Verdict
- **~220 files / ~720 test-cases movable browser→node.** ~0 dead, ~0 vacuous — **deletion reclaims nothing.**
- **Time projection ~20–25%** (NOT the earlier 40–50%). Reclaim = per-test browser-boot elimination
  (~0.7s/test), scales with the COUNT of many-small-test files moved. ⛔ A giant compute-bound sweep is the
  OPPOSITE — no boot to reclaim, node's V8 a touch slower: `middle-superset` (14336 combos) measured 81s→133s,
  STAYS in the browser. (Small sweeps fine: atc-change-twin 210-combo 3s→0.9s.) Sort by shape; measure heavy
  sweeps alone.
- Bigger reclaim beyond node-migration lives in **Phase 2** (below): de-sleeping the UI tests that stay.

## Progress
| batch | cluster | files | tests moved | aggregate |
|---|---|---|---|---|
| 1 | proof (middle-superset regressed, kept) | 2 | 46 | 7–16× |
| 2 | lathe-math | 6 | 44 | 2–12× |
| 3 | milling `*-as-data` twins | 11 | 26 | 13.3× |
| 4 | corner emit | 11 | 20 | ~13× |
| 5 | homing emit (mixed) | 5+6 split | 24 | ~28× |
| 6 | ATC (parallel agents) | 12+10 split | 60 | ~21× |
| 7 | CAM (biggest; parallel agents) | 20+12 split | 107 | ~23× |
| 8 | milling remainder (pocket/contour/rest/tapping) | 10+3 split | 88 | ~29× |
| 9 | engine/expr/gcode/guard core | 15 whole | 39 | ~13× |
| 10+ | blocks/authoring · edge/rotary/wcs · refuse-guards | queued | — | — |

Node tier **236 → 690**. `--list` browser count **3253 → 2799**. ~415 of ~720 movable moved (~58%); ~3 batches
to go.

## The discriminator
MOVABLE ⟺ every `page.evaluate` body only `import()`s app modules and asserts on returned G-code/data.
STAYS if it drives the booted app (`ddcsLoadBlockStack`/`openWiz`/`renderOpForm`/`querySelector` on rendered
DOM/`.viz` THREE), needs layout (`offsetParent`), canvas pixels, real pointer, reload, or `toHaveScreenshot`.
⭐ **Trust RUNNING over the label** (deps can be transitive — read, don't just grep). THREE now-standard
gate questions besides "does it call `page.click`?":
- **drives `io_change`?** — the harness's `dispatchEvent` is inert; a test needing it fired mid-trace STAYS
  (or splits). Can be TRANSITIVE (via `initMacrosApp`+`updateUserOp`), invisible to a test-file grep. (t2695/t2697)
- ⭐ **relies on GcodeExecutionEngine env-fallback/clamp?** (no-stock → homing-seek envelope clamp) — differs
  in node vs Chromium. CONDITIONAL on the no-stock path: a test passing an explicit stock object to
  `traceToolpath` won't hit it (t2703), so check before assuming. Caught only by RUNNING. (t2699 cam-slot-sim)
- ⛔ **`*-form-reproduction` is NOT skip-by-name — read the GENERATION MECHANISM.** Per-file `test()` calls are
  often MIXED (pure `def.bindings` test moves; real-DOM test stays → split, t2697). But a shared
  `registerFormReproductionSuite` generator makes ALL its tests real-DOM → skip the whole file (t2701).

## Movable families (grep the glob, shape-gate, move)
`*-data-emit` · `*-superset` · `*-twin` · `*-as-data` · `*-dialect` · `*-interpreter` · `*-backcompat` ·
`*-post-fold` · `*-engine` · `*-scalar-parity` · cam classifier/scratch/route/seed/compose specs · named
engine/expr/gcode/guard specs.

## Mechanism — seeding (4 patterns; same idea, different app-boot side effect the `page.goto()` stub skips)
Copy `tests/node/surfacing-as-data.test.mjs`; carry every `expect(...)` byte-for-byte.
1. `createUserOp` — when it queries `listUserOps()` OR uses `defVOf(opType)` (reads the PERSISTED store, not
   live `USER_DEFS`).
2. plain `registerUserOp(xxxDataDef())` — when it calls `builderOf(type)` directly assuming pre-seed.
3. `boot()` fresh-IF-MISSING per call — idempotent across files sharing a twin in one node process.
4. init the program model — for `window.ddcsGetBlockProgram`/`ddcsLoadBlockStack` (only exist after
   `initProgramModel()`). Also: `fetch('/data/…')` for source introspection → `fs.readFileSync`.
Matches `web/app.js` `seedDefaultPortedUserOps()`. Whole-file → delete old `.spec.js`; mixed → split, the
render/DRIVE/preview/io/env-fallback test stays in a `-<name>.spec.js`.

## Verify model
- **Per batch (light):** `npm run test:node` green (+moved total) + `npx playwright test --list` (−moved
  total) + targeted aggregate timing of only the moved specs. NO full suite.
- **Milestone (the merge gate):** ONE full suite (`npm test`, both tiers), run to COMPLETION, before merging.

## FREEBIE (repo health, separate turn)
26 specs write ~70 MB of `verification/*.png` NEVER asserted (git churn every commit). Drop/env-gate the
`page.screenshot()` calls, KEEP every data assertion. (Keep the 3 real pixel baselines.)

## Phase 2 — the resweep (after migration + milestone)
Optimize what STAYS in the browser: **DE-SLEEP** ~80s+ of fixed `waitForTimeout` → proper waits (the real
next lever — hits the expensive UI tests that dominate the clock), reduce flake/contention retries,
consolidate per-op duplicate coverage. Lighter, grep-driven.

## Follow-up bet (not now): the jsdom middle tier
~146 files are pure-logic but touch a DOM. jsdom could unlock them — but no layout engine
(offsetParent/canvas/3D return junk), so prototype on ONE file and measure fidelity+cost first.

## Hazards
- ⛔ TaskStop on a backgrounded `npm test` can orphan its child mem-server on port 3211; every later Playwright
  run then silently returns "0 tests". Grep the process tree, kill the orphan. Light verify avoids it.
- ⚠ Advisor: do NOT leave an untracked file in the shared tree during a worker turn — the worker sweeps strays
  (t2697 deleted this very plan when untracked). Advisor working files → `scratchpad/`; to TRACK, commit
  immediately in a clean window (worker idle).

## Merge
Test-only → no product risk, but a broken test on main breaks CI. **Merge gated on a green milestone
full-suite run.** Branch is cleanly ahead of main (fast-forward-able). Merge once at the end (or an interim,
also gated), in the release flow: `pull --rebase`, no force-push, no `.ver` bump, coordinate with the other seat.
