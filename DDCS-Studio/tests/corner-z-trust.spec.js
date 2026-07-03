import { test, expect } from '@playwright/test';

/**
 * Z-TRUST (t102, human-approved "wall-1 Z frame") — probeZFirst OFF: the operator's JOGGED height IS the probe height, so
 * corner REMOVES the pre-wall-1 plunge (go STRAIGHT to G31 — trust the jog) and the MANUAL-reposition auto-drop (the operator
 * RE-JOGS Z). probeZFirst ON is UNCHANGED (a real measured Z-surface → the plunge/drop are anchored to real data, they stay).
 * REAL MACHINE MOTION — byte-parity-AFFECTING. The plunge is gated via the existing zOnlyR fork so the twin's SUPERSET prunes
 * it away on the probeZ-OFF leaf too → twin==built-in. Each property is mutation-proven (see WORK-LOG).
 * Default FL/YX: fA='Y' → the first WALL probe is G31 Y (probeZ-on's first G31 overall is the Z-surface G31 Z — so we target
 * the first HORIZONTAL wall probe `G31 [XY]`).
 */
test('Z-trust: probeZ-off wall-1 straight to G31 (no pre-plunge) · probeZ-ON keeps the plunge · twin==built-in · manual-off no drop', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(CD.cornerDataDef());
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const emit = (p) => emitMapped(cornerStack(p)).text;
    const twin = (p) => emitMapped(build({ ...CD.CORNER_DEFAULTS, ...p })).text;
    // the line immediately BEFORE the first HORIZONTAL wall probe (G31 X or G31 Y — skips probeZ-on's Z-surface G31 Z)
    const beforeFirstWallG31 = (t) => { const L = t.split('\n'); const i = L.findIndex((l) => /^G31 [XY]/.test(l)); return i > 0 ? L[i - 1] : null; };
    const parity = [];
    for (const pz of [0, 1]) for (const ta of ['auto', 'manual']) {
      const p = { probeZFirst: pz, travelApproach: ta };
      parity.push({ pz, ta, equal: twin(p) === emit({ ...CD.CORNER_DEFAULTS, ...p }) });
    }
    const offAuto = emit({}), onAuto = emit({ probeZFirst: 1 });
    return {
      offAutoBefore: beforeFirstWallG31(offAuto),                           // probeZ-off auto: what precedes wall-1's G31?
      onAutoBefore: beforeFirstWallG31(onAuto),                             // probeZ-on auto: ...
      offManualHasZ18: /^G0 Z#18$/m.test(emit({ travelApproach: 'manual' })),  // probeZ-off manual: ANY G0 Z#18? (no plunge + no drop → false)
      // Option B (t105): probeZ-OFF travel lifts to the DECLARED safe Z (#19) + drops -safeZ ([0-#19]) — scanDepth (#20) unused
      // off-path. So the off travel has NO #17/#18 (those are the safeZ+scanDepth pair, probeZ-ON only). (Footer #17 excluded.)
      offAutoLift19: /^G0 Z#19$/m.test(offAuto),                            // safeZ lift after each wall probe → true
      offAutoDropNeg19: /^G0 Z\[0-#19\]$/m.test(offAuto),                   // -safeZ reposition drop → true
      offAutoDrop18: /^G0 Z#18$/m.test(offAuto),                            // no #18 on the off path (drop is now [0-#19]) → false
      onAutoLift17: /^G0 Z#17$/m.test(onAuto),                             // probeZ-ON lifts #17 (safeZ+scanDepth) → true
      onAutoDrop18: /^G0 Z#18$/m.test(onAuto),                             // probeZ-ON drops #18 → true (unchanged)
      parity,
    };
  });
  // (1) probeZ-OFF: wall-1 goes STRAIGHT to G31 — the line before it is the Step comment / G91, NOT a Z plunge.
  expect(r.offAutoBefore, 'probeZ-off: wall-1 G31 has NO preceding Z move (straight to G31 — trust the jog)').not.toMatch(/^G0 Z/);
  // (2) probeZ-ON UNCHANGED: the wall-1 G31 IS immediately preceded by the plunge `G0 Z#18` (the tool is lifted, must plunge).
  expect(r.onAutoBefore, 'probeZ-ON: wall-1 G31 still follows the plunge G0 Z#18 (unchanged)').toBe('G0 Z#18');
  // (3) twin == built-in byte-for-byte across the whole probeZFirst×travelApproach matrix (both change together via cornerStack).
  for (const c of r.parity) expect(c.equal, `twin==built-in at probeZ=${c.pz} ${c.ta}`).toBe(true);
  // (4) MANUAL-OFF has NO drop: probeZ-off manual emits NO `G0 Z#18` at all (no wall-1 plunge + no post-jog drop — operator sets Z).
  expect(r.offManualHasZ18, 'probeZ-off MANUAL: no G0 Z#18 (no pre-plunge, no auto-drop after the jog)').toBe(false);
  // (5) OPTION B — probeZ-OFF travel lifts to the DECLARED safe Z (#19) + drops -safeZ ([0-#19]); scanDepth (#20) unused off-path.
  expect(r.offAutoLift19, 'probeZ-off AUTO: the per-wall lift is #19 (safeZ), NOT #17 (safeZ+scanDepth)').toBe(true);
  expect(r.offAutoDropNeg19, 'probeZ-off AUTO: the reposition drop is [0-#19] (=-safeZ), round-trips to jogged depth').toBe(true);
  expect(r.offAutoDrop18, 'probeZ-off AUTO: NO G0 Z#18 on the off travel path (scanDepth unused)').toBe(false);
  // ...and probeZ-ON travel is UNCHANGED — the #17 lift + #18 drop (safeZ+scanDepth, anchored to the measured Z-surface) stay.
  expect(r.onAutoLift17 && r.onAutoDrop18, 'probeZ-ON: the #17 lift + #18 drop are unchanged (byte-identical)').toBe(true);
});
