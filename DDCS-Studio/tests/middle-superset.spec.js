import { test, expect } from '@playwright/test';

/**
 * MIDDLE PORT E0 — the middleStack SUPERSET is the GATE (the biggest build; byte-identical; workpiece-INDEPENDENT).
 *
 * A single all-arms-present template `middleStack({}, {superset:true})` must pruneGuards BYTE-IDENTICAL to the
 * concrete `middleStack(params)` across the FULL structural sweep — every combo of the 8 structural params
 * (featureType × inAxis × transAxis × twoAxis × circular × probeZ × wcs × syncA = 2^7 × 7 = 896). axis / dir1 / dir2 and the
 * numeric scalars are VALUE/order swaps (E1 bindings), so they stay baked at defaults on BOTH sides. INDEPENDENT
 * TRUTH: the concrete builder is a SEPARATE code path (superset:false) — the pruned superset must reproduce it
 * byte-for-byte. If it does NOT, the port STOPS here (this gate precedes E1/the data-op + bindings).
 *
 * Also folds in the transTraverse → safeTraverseStack `mode:'center'` dedup (the pre-declared byte-identical
 * extraction, previously ZERO callers): middle no longer hand-rolls the diagonal re-centre.
 */
/**
 * ── THE BUDGET IS DECLARED, AND SHARDED (t1383, ruled) ────────────────────────────────────────────────────────────
 *
 * This gate was TIMEOUT-MARGINAL against the suite's 60s per-test cap, and marginal in the worst way: it flipped either
 * way under load, so it read as a flaky test when it was actually an honest one on too small a clock. t1381 isolated it
 * two ways rather than reporting a regression — (a) the walker it was suspected of, benchmarked at 1.2µs vs 0.2µs per
 * walk, i.e. ~15ms across the whole sweep, 0.05% of a ~58s test, which cannot tip a 60s cap; and (b) back-to-back
 * ISOLATED runs, where the CHANGED tree passed at 58.9s and the BASELINE tree TIMED OUT. The cause was the clock.
 *
 * 14336 combos x (one deep clone + two full `emitMapped` builds) is simply a lot of work for one test. So the sweep is
 * SPLIT into declared shards, each with a bounded budget, rather than one test given an ever-larger timeout — which
 * would only postpone the same marginality. `SHARDS` is data: the loop below reads it, and the coverage test asserts the
 * shards partition the sweep EXACTLY (disjoint, and summing to the full count), so sharding cannot quietly drop combos
 * the way a hand-split range would. Raising the number is now the whole cost of making this faster.
 */

// t1718 named this spec's load-sensitivity (already TIMEOUT-MARGINAL by design, see above); t1724 retired the
// PER-SPEC retries declared here in favor of a config-level policy (playwright.config.js's `retries`) — a fixed
// list of "these specs get retries" goes stale every run as the starved population shifts (measured at t1719).

const SHARDS = 4;
const EXPECTED_COMBOS = 14336;   // 2^8 * 7 wcs * 2 orders * 2 dir1 * 2 dir2 — asserted, not assumed

for (let shard = 0; shard < SHARDS; shard++) {
test(`E0 GATE [shard ${shard + 1}/${SHARDS}]: prune(middleStack superset) == concrete middleStack, byte-identical across the full ${EXPECTED_COMBOS}-combo structural sweep`, async ({ page }) => {
  // A BOUNDED budget, not an open one: a shard measured at ~15s gets 4x headroom for a loaded box (this machine also
  // carries the advisor session and the analytics agent, which is what made the unsharded test flip).
  test.setTimeout(60_000);
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async ({ shard, SHARDS }) => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { pruneGuards } = await import('/blocks/whenGuard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    // the FROZEN superset template — built ONCE with defaults; every structural arm present, each guarded.
    const SUP = middleStack({}, { superset: true });
    const supGuardCount = (JSON.stringify(SUP).match(/"type":"guard"/g) || []).length;

    // the FULL structural sweep — every combo sets ALL 10 structural params EXPLICITLY (dir/scalars default on both sides).
    // t1211 — axisOrder joined the structural set: the superset now carries BOTH order arms, so the sweep must exercise
    // each one or half the template would never be pruned (and the concrete build it must match would never be compared).
    // t1237 — the DIRECTIONS joined the structural set for the same reason the order did: the superset now carries an
    // arm per (order × dir1 × dir2), so the sweep has to exercise each one or seven eighths of the template would never
    // be pruned — and the concrete build it must match would never be compared.
    const FEATS = ['pocket', 'boss'], MODES = ['auto', 'manual'], BOOLS = [false, true], ORDERS = ['XY', 'YX'], DIRS = ['pos', 'neg'];
    const WCSV = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'], SHAPES = ['dogleg', 'diagonal'];
    const combos = [];
    for (const featureType of FEATS)
      for (const inAxis of MODES)
        for (const transAxis of MODES)
          for (const travelShape of SHAPES)
            for (const twoAxis of BOOLS)
              for (const circular of BOOLS)
                for (const probeZ of BOOLS)
                  for (const wcs of WCSV)
                    for (const syncA of BOOLS)
                      for (const axisOrder of ORDERS)
                        for (const dir1 of DIRS)
                          for (const dir2 of DIRS)
                            combos.push({ featureType, inAxis, transAxis, travelShape, twoAxis, circular, probeZ, wcs, syncA, axisOrder, dir1, dir2 });

    const diffs = [];
    let leftoverGuards = 0;
    let checked = 0;
    // THE SHARD IS AN INTERLEAVE (index % SHARDS), not a contiguous block, so each shard samples the WHOLE structural
    // space rather than one corner of it — a contiguous split would put every `featureType:'boss'` combo in the last
    // shard, and a shard that fails would say much less about where the fault is.
    for (let i = 0; i < combos.length; i++) {
      if (i % SHARDS !== shard) continue;
      const c = combos[i];
      checked++;
      const pruned = JSON.parse(JSON.stringify(SUP));   // the caller clones; pruneGuards mutates in place
      pruneGuards(pruned, c);
      if (JSON.stringify(pruned).includes('"type":"guard"')) leftoverGuards++;
      const a = emitMapped(pruned).text;                // the pruned superset
      const b = emitMapped(middleStack(c)).text;        // the concrete builder (INDEPENDENT path, superset:false)
      if (a !== b) diffs.push({ c, a: a.slice(0, 1400), b: b.slice(0, 1400) });
    }

    return { supGuardCount, comboCount: combos.length, checked, diffCount: diffs.length, firstDiff: diffs[0] || null, leftoverGuards };
  }, { shard, SHARDS });

  expect(r.supGuardCount, 'the superset carries guard blocks (it IS a superset, not accidentally concrete)').toBeGreaterThan(10);
  expect(r.comboCount, 'the full structural sweep is 2^8 * 7 * 2 orders * 2 dir1 * 2 dir2 = 14336 combos').toBe(EXPECTED_COMBOS);
  // THIS SHARD really did work — the guard against a sharding bug that silently checks nothing.
  expect(r.checked, `shard ${shard + 1} covers its ${EXPECTED_COMBOS / SHARDS} combos`).toBe(EXPECTED_COMBOS / SHARDS);
  expect(r.leftoverGuards, 'prune leaves ZERO guard blocks (fully collapsed to the concrete shape)').toBe(0);
  if (r.firstDiff) console.log('FIRST DIFF @ ' + JSON.stringify(r.firstDiff.c) + '\n--- PRUNED SUPERSET ---\n' + r.firstDiff.a + '\n--- CONCRETE ---\n' + r.firstDiff.b);
  expect(r.diffCount, 'prune(superset) is BYTE-IDENTICAL to concrete middleStack for ALL structural combos (the E0 gate)').toBe(0);
});
}

/**
 * THE SHARDING ITSELF IS ASSERTED — the shards PARTITION the sweep: disjoint, and covering every combo exactly once.
 *
 * Without this, sharding is a way to make a gate faster by making it test less, and the failure would be invisible: each
 * shard would pass, the suite would be green, and some region of the structural space would simply never be compared.
 * Cheap to check (it is arithmetic over indices, no builds), so there is no excuse not to.
 */
test('E0 GATE sharding — the shards partition the sweep exactly once, with nothing dropped or doubled', async () => {
  const seen = new Map();
  for (let shard = 0; shard < SHARDS; shard++) {
    for (let i = 0; i < EXPECTED_COMBOS; i++) if (i % SHARDS === shard) seen.set(i, (seen.get(i) || 0) + 1);
  }
  expect(seen.size, `every one of the ${EXPECTED_COMBOS} combos is claimed by some shard`).toBe(EXPECTED_COMBOS);
  expect([...seen.values()].every((n) => n === 1), 'and by exactly one — the shards are disjoint').toBe(true);
});

/**
 * The transTraverse routes through safeTraverseStack `mode:'center'` — now with a travelShape fork (t383, human).
 * DEFAULT = DOGLEG: two moves, the secondary out FIRST (G0 Y#21) then the primary re-centre (G0 X[#22-#52-#10-#6]) —
 * routes AROUND the boss. travelShape='diagonal' = the pre-dedup SINGLE move (G0 X[#22-#52-#10-#6] Y#21), byte-identical
 * to the old inline. Both assign #22 (=diagPrimary #53 at rest) + #21 (Diag-travel), and put the connecting move BEFORE
 * the REPOSITION so the trace anchors the next pass to ②. (The middle-trans-traverse spec pins the trace.)
 */
test('E0 dedup: transTraverse mode:center — dogleg (default) two moves + diagonal one move', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const base = { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', inAxis: 'auto', transAxis: 'auto' };
    const dogleg = emitMapped(middleStack({ ...base })).text;                          // DEFAULT = dogleg
    const diag = emitMapped(middleStack({ ...base, travelShape: 'diagonal' })).text;   // opt-in diagonal
    return {
      has21: /^#21=50 \(/m.test(dogleg),                       // the Diag-travel assign (default 50) — emit format `#VAR=VAL ( note )`
      has22: /^#22=#53 \(/m.test(dogleg),                      // #22 assigned by mode:center (= diagPrimary default #53)
      // DOGLEG (default): secondary out FIRST (G0 Y#21), THEN re-centre primary (G0 X[#22-#52-#10-#6]) — routes AROUND
      doglegTwoMoves: /G0 Y#21\nG0 X\[#22-#52-#10-#6\]/.test(dogleg),
      doglegNoStraightDiag: !/G0 X\[#22-#52-#10-#6\] Y#21/.test(dogleg),
      // DIAGONAL (opt-in): one straight XY move — byte-identical to the pre-dedup inline
      diagOneMove: /G0 X\[#22-#52-#10-#6\] Y#21/.test(diag),
      diagNoDogleg: !/G0 Y#21\nG0 X/.test(diag),
      hasComment: /auto-traverse to the perpendicular/.test(dogleg),
      doglegBeforeRepos: dogleg.indexOf('G0 Y#21') < dogleg.indexOf('auto-traverse to the perpendicular'),
    };
  });
  expect(r.has21, 'the Diag-travel #21 is assigned (boss + twoAxis + transAxis-auto)').toBe(true);
  expect(r.has22, '#22 is assigned by mode:center (= diagPrimary default #53)').toBe(true);
  expect(r.doglegTwoMoves, 'DOGLEG (default): G0 Y#21 then G0 X[#22-#52-#10-#6] (secondary out first, then re-centre)').toBe(true);
  expect(r.doglegNoStraightDiag, 'the dogleg does NOT emit the single straight diagonal').toBe(true);
  expect(r.diagOneMove, 'DIAGONAL (opt-in): the single straight G0 X[#22-#52-#10-#6] Y#21 (pre-dedup byte-identical)').toBe(true);
  expect(r.diagNoDogleg, 'the diagonal does NOT split into two axis moves').toBe(true);
  expect(r.hasComment, 'the REPOSITION auto-traverse comment marks the perpendicular pass').toBe(true);
  expect(r.doglegBeforeRepos, 'the connecting move precedes the REPOSITION (anchors the next pass to ②)').toBe(true);
});
