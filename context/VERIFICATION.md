# VERIFICATION — which suite to run, what it costs, and where to watch it

⭐ **This is operating context, not project documentation.** It answers *how work gets proven on this
machine* — the tiers, their real cost in wall-clock, and the two traps that silently disable the tooling.
Owner-ruled 2026-08-30 after the advisor was writing "FULL SUITE" into every dispatch reflexively.

## THE TIERS

```
npm test          node 238 + e2e ~3000     25-50 MIN   the whole thing
npm run test:changed   playwright --only-changed   seconds→minutes, SELF-SCALING
npm run test:smoke     the declared manifest       fast tier (t1195)
npm run test:node      node tier alone             seconds — NOT Playwright
```

⭐ **`test:changed` self-scales, which is the important property.** It follows the import graph: touch
`formWidgets.js` and it pulls in nearly everything that imports it — effectively a full run — while touching
one op file runs a handful. That makes the shared-vs-isolated judgement mostly automatic instead of a call
someone has to make.

## ⭐⭐ THE POLICY — owner-ruled 2026-08-30

```
JS / test changes      test:changed + node tier. It expands itself on shared files.
CSS / asset changes    FULL SUITE (or smoke + the relevant screenshot specs).
                       ⛔ The import graph is BLIND to CSS — no spec imports
                       styles.css, so --only-changed maps it to nothing.
unclear blast radius   the worker's call; they have been reliable on this
```

⚠ **Whatever tier runs, the failed count must still be ATTRIBUTABLE** — named individually, each one either
tied to this turn's own change or shown pre-existing. That discipline is what has caught the
misattributions; suite *size* never did.

### THE EVIDENCE BEHIND THE RULING — including against the old policy

- ⛔ **Against "always run everything":** the `array.js` field-hiding regression (introduced t2385, found
  t2393) survived **multiple full suites over two days**. It was found by a worker *building on* the code,
  not by testing it. A full suite only catches what has a test.
- ⭐ **For running everything on CSS:** t2371 widened `hasTreeLayout()`, passed every targeted check its
  author ran, and **regressed 21 tests** — blank preview panes, dropped section-grouping across four
  wizards. Only the full run caught it. This week's other cross-file surprises were CSS too: dropdowns
  silently eating saved layout values, the caption fix that missed its second hiding path, the 60px
  keyboard pin.

⇒ **The expensive run earns its time exactly where the cheap one is blind.**

## WHERE TO WATCH IT

The suite writes its own progress as it goes — no terminal needed:

```
test-results/progress.md     ⭐ open in VS CODE'S MARKDOWN PREVIEW and dock it.
                             Re-renders on disk change; no server involved, so it
                             does not compete with the app's own Live Preview.
test-results/progress.html   numbers baked in + a 2s meta-refresh — opens as a
                             plain file:// on a PHONE. No fetch, no CORS, no server.
test-results/progress.json   for tooling; the advisor reads it to answer "how far?"
```

Every **Playwright** tier fills the same file — smoke and `--only-changed` inherit the reporter because
`playwright.smoke.config.js` spreads the base config and overrides only `testMatch`. ⚠ `test:node` is not
Playwright and reports nothing.

⚠ It carries a **heartbeat timestamp**: a run that dies reads as *stalled*, not as a confident 47%.

## ⛔ THE TWO TRAPS

1. ⛔⛔ **NEVER pass `--reporter=` on the command line.** It does not add a reporter — it **REPLACES THE
   WHOLE LIST** from the config. You lose the progress files AND `summary.json`, which `test-all.cjs` reads
   for the flaky count. This silently cost a whole session's progress reporting before the owner spotted it.
2. ⛔ **Never run two Playwright suites at once.** Parallel runs produce mass timeout reds that look like
   real failures. Serialize them — if one seat has a suite live, the other waits.

## ⭐⭐ THE FULL SUITE NEEDS A QUIET-ENOUGH MACHINE — worker count is re-measured, not permanent

`playwright.config.js`'s own `workers:` number is a measurement of THIS machine at a point in time, not a
constant. t2443 (2026-08-31) found `workers:6` (set at t1593, 2026-08-06, on a then-quieter machine) now
comes back **46 FAILED** — spanning totally unrelated domains (alignment, ATC, add-operation, Blocks), the
signature of resource starvation rather than a logic defect, reproduced identically across two clean runs.
`workers:4` on the same machine, same moment: **0 failed**. Not a fluke — the owner confirmed directly no
other agent was running; a progress-reporter write-volume theory was disproved by arithmetic first.

**Why the number goes stale:** the config's own worker count assumes a baseline load for the machine it was
measured on. This machine's ordinary baseline (VS Code, two concurrent Claude Code seats, ~28 Chrome + ~17
node processes even before Playwright starts) had grown enough in 3.5 weeks / ~600 tests of suite growth
that 6 workers — each driving its own Chromium — oversubscribed it. `retries:2` (the same config file)
already absorbs ordinary one-off contention; failing all 3 attempts, on the SAME 46 tests twice, is what
made "ordinary noise" unconvincing and pointed at a systematic ceiling instead.

**How to apply:** if a full-suite run comes back with a LARGE (double-digit+), CROSS-DOMAIN failure set that
doesn't match any single turn's own change (confirm via the A/B pattern: same failures reproduce at HEAD
before that turn's change existed), don't chase it as a code regression first — suspect the worker count
against the machine's CURRENT ordinary load. The decisive, cheap test: re-run with a lower `--workers`
override; if the failure set collapses toward the usual near-zero baseline, the fix is a config number plus
a dated comment recording the new measurement (`playwright.config.js`'s own comment on `workers:` is the
log of every past measurement — extend it, don't replace it). If the failures do NOT collapse, stop and
treat it as a real regression instead — bisect the day's own commits.

### ⭐ TWO-BOX CONFIRMATION (t3005, 2026-09-07) — the flake is the LOAD SHAPE, not the specs

Measured on the ASUS (Ryzen 7 4800H, half Ranchy's cores) under the exact `node scripts/test-all.cjs
--shard=1/40` node-then-e2e shape:

```
workers   wall     flaky   unexpected      (each row = 70 tests)
2         1m55s    0       0
4 (dflt)  1m44s    3       0
6         1m45s    5       0
```

Two things this settles. **(1)** Ranchy's 3 shard-1 flakes (`align-rotate-gui`, `alignment-canvas-refit-732`,
`add-operation-1940`) are NOT defective specs — they pass single, no-retry, at 2/4/6 workers on the ASUS,
checked individually. **(2)** The ASUS's own w4 run flaked too — three specs, DIFFERENT ones
(`alignment-correction-840`, +more at w6). ⇒ **The node-then-e2e-at-N-workers shape induces contention flake
on BOTH boxes; WHICH specs tip is box-specific. The lever is the load shape + worker count, never the specs.**
Note it heals on retry when watched but is a false red in an unattended merged report — hence the ASUS runs
`PW_WORKERS=2` (t3007): ~10% slower wall, bought for determinism in its unattended role. `PW_WORKERS` is the
per-box mechanism; the committed default stays `4`.

⚠ **Ranchy's own `4` (t2443, 2026-08-31) is now itself inherited.** This box has since added a pusher, the
progress worker, and a second Claude seat to its baseline — the exact "load grew, re-measure" condition above.
The shard-1 flakes are plausibly that. A re-measure against the CURRENT baseline is a non-urgent open item
(`PW_WORKERS` here too if it earns it) — not yet done.

## ⚠ AND THE COST THAT IS NOT WALL-CLOCK

The reporter also keeps the worker's captured stdout at **~2.8 KB instead of ~530 KB** (the old per-test
line spew). That saving repeats every run, so the tier choice is not only about minutes.
