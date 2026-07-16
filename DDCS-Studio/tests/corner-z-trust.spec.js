import { test, expect } from '@playwright/test';

/**
 * Z-TRUST (t102) + t824/t826 SAFE-Z + t897 HONEST DROP: the pre-wall-1 PLUNGE, the straight-to-G31 trust, and the
 * twin==built-in parity are UNCHANGED. t824/t826: the per-wall RETREAT retracts to the DECLARED MACHINE MARGIN via G53
 * (limit-proof, absolute). t897 (this test's regen): the reposition DROP is no longer a RELATIVE value ([0-#19] / #18) —
 * an absolute G53 lift + a relative drop landed an ARBITRARY Z (the crash-adjacent bug). It now emits an HONEST pairing:
 * a SAVE of the pre-lift machine Z (`#95=#882 ( @saveProbeZ )`, in probeWallR before the G53 lift) and a RETURN to it
 * (`G53 Z#95 ( @returnProbeZ )`), so the next wall probes from the SAME Z by construction (the RESULTING Z is proven in
 * lift-drop-pairing-897; this golden asserts the EMIT). Default FL/YX: fA='Y' → the first WALL probe is G31 Y (probeZ-on's
 * first G31 overall is the Z-surface G31 Z — so we target the first HORIZONTAL wall probe `G31 [XY]`).
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
      // t824/t826 — the per-wall RETREAT is now the machine-frame G53 retract (register #520 on Expert); the OLD incremental
      // safeZ/#17 per-wall LIFT is RETIRED. t897 — the reposition DROP is now the SAVE + honest RETURN, NOT a relative value.
      retreatG53: /^G53 Z#520$/m.test(offAuto),                            // the per-wall retreat is the machine-frame margin → true
      offAutoLift19: /^G0 Z#19$/m.test(offAuto),                            // the OLD incremental safeZ per-wall lift is GONE on the off path → false
      offAutoDropNeg19: /^G0 Z\[0-#19\]$/m.test(offAuto),                   // t897 — the OLD relative reposition drop [0-#19] is RETIRED → false
      offAutoDrop18: /^G0 Z#18$/m.test(offAuto),                            // no #18 on the off path → false
      onAutoLift17: /^G0 Z#17$/m.test(onAuto),                             // the OLD incremental #17 per-wall lift is GONE → false
      // t897 — probeZ-ON has TWO `G0 Z#18` sources: the wall-1 pre-probe PLUNGE (kept) + the OLD reposition drop (RETIRED).
      // The reposition-drop retirement drops the count 2 -> 1 (only the plunge remains). (probeZ-OFF has NO plunge, so its
      // drop [0-#19] retirement is asserted directly to false above.)
      onAutoDrop18Count: (onAuto.match(/^G0 Z#18$/gm) || []).length,       // t897 → 1 (the plunge only; the reposition drop is gone)
      // t897 — the HONEST pairing: the SAVE (before the G53 lift) + the RETURN (replacing the relative drop), both probeZ states.
      offAutoSave: /^#95=#882 \( @saveProbeZ \)$/m.test(offAuto),          // save the pre-lift Z → true
      offAutoReturn: /^G53 Z#95 \( @returnProbeZ \)$/m.test(offAuto),      // return to it (drop replacement) → true
      onAutoSave: /^#95=#882 \( @saveProbeZ \)$/m.test(onAuto),            // true
      onAutoReturn: /^G53 Z#95 \( @returnProbeZ \)$/m.test(onAuto),        // true
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
  // (5) t824/t826 — the per-wall RETREAT is the machine-frame G53 margin (limit-proof); the OLD incremental safeZ/#17 LIFT is GONE.
  expect(r.retreatG53, 'the per-wall retreat is the machine-frame G53 Z#520 margin').toBe(true);
  expect(r.offAutoLift19, 'probeZ-off AUTO: the OLD incremental safeZ (#19) per-wall lift is RETIRED').toBe(false);
  expect(r.onAutoLift17, 'probeZ-ON: the OLD incremental #17 per-wall lift is RETIRED').toBe(false);
  // (6) t897 — the OLD relative reposition DROP is RETIRED (it landed an arbitrary Z off the absolute lift); the HONEST
  // save+return replaces it, so the next wall returns to the saved probe depth by construction.
  expect(r.offAutoDropNeg19, 'probeZ-off AUTO: the OLD relative drop [0-#19] is RETIRED (t897)').toBe(false);
  expect(r.offAutoDrop18, 'probeZ-off AUTO: NO G0 Z#18 on the off travel path').toBe(false);
  expect(r.onAutoDrop18Count, 'probeZ-ON: exactly ONE G0 Z#18 remains (the wall-1 plunge); the OLD reposition drop #18 is RETIRED (t897)').toBe(1);
  // (7) t897 — the HONEST lift/drop pairing emits: a SAVE of the pre-lift Z (before the G53 lift) + a RETURN to it (the drop).
  expect(r.offAutoSave, 'probeZ-off AUTO: saves the pre-lift Z (#95=#882 ( @saveProbeZ ))').toBe(true);
  expect(r.offAutoReturn, 'probeZ-off AUTO: returns to the saved Z (G53 Z#95 ( @returnProbeZ ))').toBe(true);
  expect(r.onAutoSave, 'probeZ-ON AUTO: saves the pre-lift Z').toBe(true);
  expect(r.onAutoReturn, 'probeZ-ON AUTO: returns to the saved Z').toBe(true);
});
