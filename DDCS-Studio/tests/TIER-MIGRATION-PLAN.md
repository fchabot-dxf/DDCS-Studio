# Test-suite tier-migration — the plan (tracked)

Moving pure-logic tests out of the browser (Playwright) tier into the fast node tier
(`tests/node/*.test.mjs`, harness `tests/node/support/harness.mjs`). Origin: a 6-agent read-only audit
(2026-09-06) of the ~3250-test suite. Owner bet: suite-time reduction. It is the ONE live suite — `npm test`
runs `scripts/test-all.cjs`, which runs BOTH tiers (`test:node` + `test:e2e`), so a test moving e2e→node still
runs under `npm test`; coverage is preserved by construction.

## Verdict
- **~220 files / ~720 test-cases movable browser→node.** ~0 dead, ~0 vacuous — **deletion reclaims nothing.**
- **Time projection ~20–25%** (NOT the earlier 40–50%). Reclaim = per-test browser-boot elimination
  (~0.7s/test), so it scales with the COUNT of *many-small-test* files moved. ⛔ A giant compute-bound
  combinatorial sweep is the OPPOSITE — no boot to reclaim, node's V8 a touch slower: `middle-superset`
  (14336 combos) measured 81s→133s and STAYS in the browser. Sort by shape; measure any heavy sweep alone.
  (Small sweeps are fine: atc-change-twin 210-combo measured 3s→0.9s in node.)
- The bigger reclaim beyond node-migration lives in **Phase 2** (below): de-sleeping the UI tests that stay.

## Progress
| batch | cluster | files | tests moved | aggregate |
|---|---|---|---|---|
| 1 | proof (lathe-odturn, holecycle; middle-superset regressed) | 2 | 46 | 7–16× |
| 2 | lathe-math | 6 | 44 | 2–12× |
| 3 | milling `*-as-data` twins | 11 | 26 | 13.3× |
| 4 | corner emit | 11 | 20 | ~13× |
| 5 | homing emit (mixed) | 5+6 split | 24 | ~28× |
| 6 | ATC (first big batch, 4 parallel convert-agents) | 12+10 split | 60 | ~21× |
| 7+ | CAM · milling remainder · engine/expr · blocks · edge/rotary/wcs | queued | — | — |

Node tier **236 → 456**. `--list` browser count **3253 → 3033**. ~8 more upsized batches to go.

## The discriminator
MOVABLE ⟺ every `page.evaluate` body only `import()`s app modules and asserts on returned G-code/data.
STAYS if a body drives the booted app (`ddcsLoadBlockStack`/`openWiz`/`renderOpForm`/`querySelector` on
rendered DOM/`.viz` THREE scene), needs layout (`offsetParent`), canvas pixels, real pointer, reload, or a
`toHaveScreenshot`. ⭐ **Trust RUNNING over the label.** Two shape-gate questions are now as standard as
"does it call `page.click`?":
- **"does it drive `io_change`?"** — the node harness's `dispatchEvent` is deliberately inert; a test that
  registers a real `io_change` listener and needs it fired mid-trace must STAY (or split). Hit repeatedly
  (t2695 homing-limit-trip, t2697 atc-dialect/collet/station-devices).
- ⛔ **`*-form-reproduction` is NOT a skip-by-name signal.** Many are MIXED: a pure `def.bindings`/"section
  matches" test (moves) beside a real-DOM `renderOpForm`+`querySelectorAll` "live order" test (stays). READ
  them in full; split (t2697 atc-batch-form-reproduction split 6/6).

## Movable families (grep the glob, shape-gate, move)
`*-data-emit` · `*-superset` · `*-twin` · `*-as-data` · `*-dialect` · `*-interpreter` · `*-backcompat` ·
`*-post-fold` · `*-engine` · `*-scalar-parity` · cam classifier/scratch/route/seed/compose specs · named
engine/expr/guard specs (engine-trace, fills, g53-mode-explicit, expr-*, guard-prune, op-sim-*, …).

## Mechanism — seeding patterns (4 discovered; same idea, different app-boot side effect)
Copy `tests/node/surfacing-as-data.test.mjs`; carry every `expect(...)` byte-for-byte. Seed the twin/state the
node harness's `page.goto()` stub never sets up:
1. `createUserOp` — when the file queries `listUserOps()`.
2. plain `registerUserOp(xxxDataDef())` — when it calls `builderOf(type)` directly assuming pre-seed.
3. `boot()` fresh-IF-MISSING per call — idempotent across files sharing a twin in one node process.
4. init the program model — when it needs `window.ddcsGetBlockProgram`/`ddcsLoadBlockStack` (only exist after
   `initProgramModel()`, never reached by the node harness); trace the dep graph, add the seed line (t2697).
Matches `web/app.js` `seedDefaultPortedUserOps()`. Whole-file → delete old `.spec.js`; mixed → split, the
render/DRIVE/preview/io-driving test stays in a `-<name>.spec.js`.

## Verify model
- **Per batch (light):** `npm run test:node` green (+moved total) + `npx playwright test --list` (−moved
  total) + a targeted aggregate timing of only the moved specs. NO full suite.
- **Milestone (the merge gate):** ONE full suite (`npm test`, both tiers), run to COMPLETION, before merging.

## FREEBIE (repo health, separate turn)
26 specs write ~70 MB of `verification/*.png` NEVER asserted (git churn every commit). Drop/env-gate the
`page.screenshot()` calls, KEEP every data assertion. (Keep the 3 real pixel baselines.)

## Phase 2 — the resweep (after migration + milestone)
Optimize what STAYS in the browser: **DE-SLEEP** ~80s+ of fixed `waitForTimeout` → proper waits (the real
next lever — hits the expensive UI tests that dominate the clock), reduce flake/contention retries,
consolidate per-op duplicate coverage. Lighter, grep-driven — not a full semantic audit.

## Follow-up bet (not now): the jsdom middle tier
~146 files are pure-logic but touch a DOM (`renderOpForm`, read `[data-param]`). A jsdom tier could unlock
them — but no layout engine (offsetParent/canvas/3D return junk), so prototype on ONE file and measure
fidelity+cost before building. node-canvas (2D) / headless-gl (3D) are heavier, riskier variants.

## Hazards
- ⛔ TaskStop on a backgrounded `npm test` can orphan its child mem-server on port 3211; with
  `webServer.reuseExistingServer:false` every later Playwright run then silently returns "0 tests". Grep the
  process tree, kill the orphan. Light verify avoids it (no full suite to kill).
- ⚠ Advisor: do NOT leave an untracked file in the shared working tree during a worker turn — the worker
  sweeps stray untracked files (t2697 deleted this very plan doc when it was untracked in `tests/`). Write
  advisor working files in `scratchpad/` (the worker leaves it untouched), and commit a to-be-tracked file
  only in a clean window (worker idle), immediately.

## Merge
Test-only changes → no product risk, but a broken test on main breaks everyone's CI. So **merge gated on a
green milestone full-suite run.** Branch is cleanly ahead of main (fast-forward-able). Merge once at the end
(or an interim, also gated), folded into the release flow: `pull --rebase`, no force-push, no `.ver` bump
(tests don't deploy), coordinate with the other seat.
