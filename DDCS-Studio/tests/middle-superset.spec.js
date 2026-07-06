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
test('E0 GATE: prune(middleStack superset) == concrete middleStack, byte-identical across the full 896-combo structural sweep', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { pruneGuards } = await import('/blocks/whenGuard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    // the FROZEN superset template — built ONCE with defaults; every structural arm present, each guarded.
    const SUP = middleStack({}, { superset: true });
    const supGuardCount = (JSON.stringify(SUP).match(/"type":"guard"/g) || []).length;

    // the FULL structural sweep — every combo sets ALL 8 structural params EXPLICITLY (axis/dir/scalars default on both sides).
    const FEATS = ['pocket', 'boss'], MODES = ['auto', 'manual'], BOOLS = [false, true];
    const WCSV = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'];
    const combos = [];
    for (const featureType of FEATS)
      for (const inAxis of MODES)
        for (const transAxis of MODES)
          for (const twoAxis of BOOLS)
            for (const circular of BOOLS)
              for (const probeZ of BOOLS)
                for (const wcs of WCSV)
                  for (const syncA of BOOLS)
                    combos.push({ featureType, inAxis, transAxis, twoAxis, circular, probeZ, wcs, syncA });

    const diffs = [];
    let leftoverGuards = 0;
    for (const c of combos) {
      const pruned = JSON.parse(JSON.stringify(SUP));   // the caller clones; pruneGuards mutates in place
      pruneGuards(pruned, c);
      if (JSON.stringify(pruned).includes('"type":"guard"')) leftoverGuards++;
      const a = emitMapped(pruned).text;                // the pruned superset
      const b = emitMapped(middleStack(c)).text;        // the concrete builder (INDEPENDENT path, superset:false)
      if (a !== b) diffs.push({ c, a: a.slice(0, 1400), b: b.slice(0, 1400) });
    }

    return { supGuardCount, comboCount: combos.length, diffCount: diffs.length, firstDiff: diffs[0] || null, leftoverGuards };
  });

  expect(r.supGuardCount, 'the superset carries guard blocks (it IS a superset, not accidentally concrete)').toBeGreaterThan(10);
  expect(r.comboCount, 'the full structural sweep is 2^7 * 7 = 896 combos').toBe(896);
  expect(r.leftoverGuards, 'prune leaves ZERO guard blocks (fully collapsed to the concrete shape)').toBe(0);
  if (r.firstDiff) console.log('FIRST DIFF @ ' + JSON.stringify(r.firstDiff.c) + '\n--- PRUNED SUPERSET ---\n' + r.firstDiff.a + '\n--- CONCRETE ---\n' + r.firstDiff.b);
  expect(r.diffCount, 'prune(superset) is BYTE-IDENTICAL to concrete middleStack for ALL 896 structural combos (the E0 gate)').toBe(0);
});

/**
 * The transTraverse → safeTraverseStack `mode:'center'` dedup is byte-identical: a boss + twoAxis + transAxis-auto
 * emits the exact re-centre diagonal the pre-dedup inline produced. #22 is now assigned INSIDE mode:'center' (not
 * hand-rolled), the primary leg targets #22 (=diagPrimary #53 at rest), the secondary leg travels out by #21, and the
 * move precedes the REPOSITION so the trace anchors the next pass to ②. (The middle-trans-traverse spec pins the trace.)
 */
test('E0 dedup: transTraverse routes through mode:center byte-identical (the re-centre diagonal)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const auto = emitMapped(middleStack({ featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', inAxis: 'auto', transAxis: 'auto' })).text;
    return {
      has21: /^#21=50 \(/m.test(auto),                         // the Diag-travel assign (default 50) — emit format `#VAR=VAL ( note )`
      has22: /^#22=#53 \(/m.test(auto),                        // #22 assigned by mode:center (= diagPrimary default #53)
      hasDiag: /G0 X\[#22-#52-#10-#6\] Y#21/.test(auto),       // the re-centre diagonal: primary → #22, secondary out by #21
      hasComment: /auto-traverse to the perpendicular/.test(auto),
      moveBeforeRepos: auto.indexOf('G0 X[#22-#52-#10-#6] Y#21') < auto.indexOf('auto-traverse to the perpendicular'),
    };
  });
  expect(r.has21, 'the Diag-travel #21 is assigned (boss + twoAxis + transAxis-auto)').toBe(true);
  expect(r.has22, '#22 is assigned by mode:center (= diagPrimary default #53)').toBe(true);
  expect(r.hasDiag, 'the re-centre diagonal G0 X[#22-#52-#10-#6] Y#21 is byte-identical to the pre-dedup inline').toBe(true);
  expect(r.hasComment, 'the REPOSITION auto-traverse comment marks the perpendicular pass').toBe(true);
  expect(r.moveBeforeRepos, 'the diagonal move precedes the REPOSITION (anchors the next pass to ②)').toBe(true);
});
