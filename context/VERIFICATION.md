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

## ⚠ AND THE COST THAT IS NOT WALL-CLOCK

The reporter also keeps the worker's captured stdout at **~2.8 KB instead of ~530 KB** (the old per-test
line spew). That saving repeats every run, so the tier choice is not only about minutes.
