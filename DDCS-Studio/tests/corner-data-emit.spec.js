import { test, expect } from '@playwright/test';

/**
 * CORNER-PORT inc B1 — EMIT. The corner built-in expressed as a DATA def (blocks/dataOps/cornerData.js) emits G-code
 * byte/value-identical to the hand-coded cornerStack across a sweep of the BOUND scalars — CRUCIALLY with binding
 * blockIndexes DERIVED programmatically (deriveBindings.js) from the flattened user_root stack, never hand-counted.
 * That is the fix for the shipped defect #1 (a hand-counted map that skipped the `=== CONFIGURATION ===` comment →
 * every binding shifted by one → registerUserOp threw / mis-bound). Corner header comments interpolate params, so the
 * compare is via stripAnnotations (FUNCTIONAL equivalence, the same yardstick probe-surface-block.spec uses).
 *
 * FRONTIERS held BAKED (asserted as divergences, like slot's pattern/clearance): probeZFirst (structural — inserts a
 * Z-surface step), safeZ (fan-out → #19 + the computed #17), and the structural corner quadrant. The derive-robustness
 * block proves the helper RE-FINDS the shifted #23/#24 when probeZFirst inserts #21/#22 — defect #1's ROOT guard.
 * SCOPE: emit only — no cornerView/panel (inc B3), no sim starts / inferStarts (inc B2).
 */
test('corner-data-emit: functional G-code == cornerStack across a bound-scalar sweep + derived-binding wiring', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE, CORNER_BINDINGS, CORNER_BINDING_SPECS, cornerDataStack } = await import('/blocks/dataOps/cornerData.js');
    const { emitEquivalence, stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const { deriveBindingsFor } = await import('/blocks/dataOps/deriveBindings.js');
    const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
    const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
    const { SCHEMA } = await import('/blocks/opSchema.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    registerUserOp(cornerDataDef());
    const dataBuilder = builderOf(CORNER_DATA_OPTYPE);   // === instantiate(def, …): an INDEPENDENT path from cornerStack

    const base = CORNER_DEFAULTS;
    const S = (o) => ({ ...base, ...o });   // structural params stay at their baked defaults; only bound scalars vary

    // Sweep the 9 bound scalars. Default rows (no cross override) exercise the signed-travelDist reposition; travelDist scales
    // it (#15); cross1_x/cross1_y OVERRIDE the reposition socket with a literal (both sides identically → agreement holds).
    const sweep = [
      S({}),
      S({ dist: 300 }),
      S({ dist: 800, retract: 8 }),
      S({ retract: 2 }),
      S({ f_fast: 250, f_slow: 40 }),
      S({ f_slow: 80 }),
      S({ port: 5 }),
      S({ radius: 3 }),
      S({ radius: 2.5 }),
      S({ travelDist: 30 }),
      S({ travelDist: 80 }),
      S({ cross1_x: 15 }),
      S({ cross1_y: 20 }),
      S({ cross1_x: -12, cross1_y: 8 }),
      S({ cross1_x: 40, cross1_y: -30 }),
      S({ dist: 250, retract: 6, f_fast: 220, f_slow: 45, port: 4, radius: 2.5, travelDist: 60, cross1_x: 18, cross1_y: 22 }),
    ];

    // FUNCTIONAL byte-identity (corner header comments interpolate params → normalize with stripAnnotations).
    const main = emitEquivalence(cornerStack, dataBuilder, sweep, {}, stripAnnotations);

    // FRONTIERS — MUST diverge (the twin bakes these; the built-in keeps them working):
    const probeZFirstDiv = emitEquivalence(cornerStack, dataBuilder, [S({ probeZFirst: 1 })], {}, stripAnnotations);   // structural: inserts a Z step (still baked → diverges)
    const cornerDiv      = emitEquivalence(cornerStack, dataBuilder, [S({ corner: 2 })], {}, stripAnnotations);       // structural: FR direction signs (still baked → diverges)
    const travelDiv      = emitEquivalence(cornerStack, dataBuilder, [S({ travelApproach: 'manual' })], {}, stripAnnotations);   // structural: manual jog-prompt (still baked → diverges)
    // ② B4(c) — fan-out DISSOLVED: safeZ + scanDepth are now LIVE single-socket bindings (#17=[#19+#20] recomputes on the
    // controller), so a bound safeZ/scanDepth now CONVERGES with cornerStack (was a baked frontier that diverged).
    const safeZConv      = emitEquivalence(cornerStack, dataBuilder, [S({ safeZ: 25 })], {}, stripAnnotations);
    const scanDepthConv  = emitEquivalence(cornerStack, dataBuilder, [S({ scanDepth: 8 })], {}, stripAnnotations);

    // DERIVE-ROBUSTNESS — the defect #1 ROOT guard: build the template under probeZFirst=on (which inserts #21/#22) and
    // confirm deriveBindings RE-FINDS the shifted #23/#24 (+2), while the pre-Z scalars are unmoved. A hand-count can't.
    const bindOn = deriveBindingsFor(cornerDataStack({ ...base, probeZFirst: 1 }), CORNER_BINDING_SPECS);
    const idx = (arr, p) => (arr.find((b) => b.param === p) || {}).blockIndex;
    const robustness = {
      crossXShift: idx(bindOn, 'cross1_x') - idx(CORNER_BINDINGS, 'cross1_x'),
      crossYShift: idx(bindOn, 'cross1_y') - idx(CORNER_BINDINGS, 'cross1_y'),
      distStable:  idx(bindOn, 'dist') - idx(CORNER_BINDINGS, 'dist'),
      onCount: bindOn.length,
    };

    // BINDING WIRING — every binding routes its param to the SAME assign var cornerStack writes (String-normalized because
    // cornerStack stores assign values via String(val); instantiate writes the raw number → both emit identically).
    const SENT = 4242;
    const wiringFails = [];
    for (const b of CORNER_BINDINGS) {
      const spec = CORNER_BINDING_SPECS.find((s) => s.param === b.param);
      const dataSock = (flattenBlocks(dataBuilder(S({ [b.param]: SENT })))[b.blockIndex] || {}).params || {};
      const refBlk = flattenBlocks(cornerStack(S({ [b.param]: SENT }))).find((blk) => blk && blk.type === 'assign' && blk.params && String(blk.params.var) === String(spec.match.var));
      const dataOk = String(dataSock[b.key]) === String(SENT);
      const refOk = !!refBlk && String(refBlk.params.value) === String(SENT);
      if (!dataOk || !refOk) wiringFails.push({ param: b.param, blockIndex: b.blockIndex, var: spec.match.var, dataOk, refOk });
    }

    const sample = stripAnnotations(emitMapped(dataBuilder(S({}))).text);
    return {
      resolves: typeof dataBuilder === 'function',
      independentPath: dataBuilder !== cornerStack,
      pristine: BUILDERS[CORNER_DATA_OPTYPE] === undefined && SCHEMA[CORNER_DATA_OPTYPE] === undefined,
      bindingCount: CORNER_BINDINGS.length,
      wiringFails,
      main: { pass: main.pass, count: main.count, firstDiff: main.firstDiff && { params: main.firstDiff.params, a: main.firstDiff.a.slice(0, 700), b: main.firstDiff.b.slice(0, 700) } },
      probeZFirstPass: probeZFirstDiv.pass,
      cornerPass: cornerDiv.pass,
      travelPass: travelDiv.pass,
      safeZConvPass: safeZConv.pass,
      scanDepthConvPass: scanDepthConv.pass,
      robustness,
      sampleHasProbe: /G31/.test(sample),
      sampleLen: sample.length,
    };
  });

  expect(r.resolves, 'corner-data-emit resolves via builderOf').toBe(true);
  expect(r.independentPath, 'data builder is NOT cornerStack (independent code path)').toBe(true);
  expect(r.pristine, 'lives in the user layer; built-in BUILDERS/SCHEMA untouched').toBe(true);
  expect(r.bindingCount, 'the 11 bound scalars: 6 clean + travelDist(#15) + safeZ(#19) + scanDepth(#20) + cross1_x/cross1_y (safeZ/scanDepth un-baked by the #17 fan-out fix)').toBe(11);
  expect(r.wiringFails, 'every DERIVED binding routes to the same assign var cornerStack writes (defect #1 guard)').toEqual([]);
  if (!r.main.pass) console.log('FIRST DIFF @', JSON.stringify(r.main.firstDiff && r.main.firstDiff.params) + '\n--- cornerStack ---\n' + (r.main.firstDiff && r.main.firstDiff.a) + '\n--- data def ---\n' + (r.main.firstDiff && r.main.firstDiff.b));
  expect(r.main.count, 'the sweep is substantial').toBeGreaterThan(12);
  expect(r.main.pass, 'corner-data == cornerStack (functional/stripAnnotations) across the bound-scalar sweep').toBe(true);
  // Derive-robustness: probeZFirst=on inserts #21/#22, so #23/#24 shift +2; the pre-Z scalars do not move.
  expect(r.robustness.crossXShift, 'deriveBindings re-finds #23 (cross1_x) shifted +2 under probeZFirst').toBe(2);
  expect(r.robustness.crossYShift, 'deriveBindings re-finds #24 (cross1_y) shifted +2 under probeZFirst').toBe(2);
  expect(r.robustness.distStable, 'a pre-Z scalar (dist/#1) is unmoved — the derive is not a blanket offset').toBe(0);
  expect(r.robustness.onCount, 'all 11 bindings still resolve under the probeZFirst shape').toBe(11);
  // FRONTIERS — STILL baked (structural), must diverge until B4 makes them live.
  expect(r.probeZFirstPass, 'frontier: probeZFirst inserts a Z-surface step (structure swap the static template cannot do)').toBe(false);
  expect(r.cornerPass, 'frontier: the corner quadrant is structural (direction signs + comments) — baked in the twin').toBe(false);
  // ② B4(c): safeZ + scanDepth are NO LONGER frontiers — the #17=[#19+#20] fan-out fix made them live single-socket bindings.
  expect(r.safeZConvPass, 'safeZ is now a LIVE binding (→#19; #17=[#19+#20] recomputes) → CONVERGES with cornerStack').toBe(true);
  expect(r.scanDepthConvPass, 'scanDepth is now a LIVE binding (→#20) → CONVERGES with cornerStack').toBe(true);
  expect(r.travelPass, 'frontier: travelApproach=manual swaps the auto G0 move for a #1505 jog prompt (structure swap the static template cannot do) — twin bakes auto').toBe(false);
  expect(r.sampleHasProbe, 'emits a real probe move (G31)').toBe(true);
  expect(r.sampleLen, 'emits substantial G-code').toBeGreaterThan(200);
});

/**
 * KNOWN-GOOD GOLDEN (inc B1b) — the agreement sweep above proves "twin == cornerStack", but agreement ALONE hid the shipped
 * degenerate default (both emitted `G0 X0 Y0`). This pins the CONTENT: a DEFAULT "Corner (data)" (no user input) must emit a
 * NON-DEGENERATE signed-travelDist reposition. Targeted line-anchored checks (not a brittle full-string golden). The twin bakes
 * FL / YX / travelDist=50 → reposition X socket #23 = #16 (−td), Y socket #24 = #15 (+td); #15=50, #16=[0-#15].
 */
test('corner-data-emit GOLDEN: a DEFAULT Corner (data) emits a NON-DEGENERATE reposition (kills G0 X0 Y0)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const emit = await page.evaluate(async () => {
    const { cornerDataDef, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(cornerDataDef());
    const dataBuilder = builderOf(CORNER_DATA_OPTYPE);
    return stripAnnotations(emitMapped(dataBuilder({})).text);   // {} → all binding defaults = the shipped operator default
  });
  // POSITIVE — the travel vars + the reposition sockets carry signed-travelDist expressions, and the move references them:
  expect(emit, '#15 = +travelDist (the bound scalar)').toMatch(/^#15=50$/m);
  expect(emit, '#16 = -#15 (derives from travelDist → no fan-out)').toMatch(/^#16=\[0-#15\]$/m);
  expect(emit, '#23 (X cross) holds the signed-travel expression, not 0').toMatch(/^#23=#16$/m);
  expect(emit, '#24 (Y cross) holds the signed-travel expression, not 0').toMatch(/^#24=#15$/m);
  expect(emit, 'the reposition MOVE references the sockets').toMatch(/^G0 X#23 Y#24$/m);
  // NEGATIVE — the degenerate default is GONE (both failure modes: an inlined zero move, and #23/#24 resolving to 0):
  expect(emit, 'no inlined zero reposition').not.toMatch(/^G0 X0 Y0$/m);
  expect(/^#23=0$/m.test(emit) || /^#24=0$/m.test(emit), 'no zero reposition socket').toBe(false);
});
