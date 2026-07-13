import { test, expect } from '@playwright/test';

/**
 * Z-TRUST (t102) + t824/t826 SAFE-Z: the pre-wall-1 PLUNGE, the straight-to-G31 trust, and the twin==built-in parity are
 * UNCHANGED. What CHANGED (t824 amendment, field evidence — the user probed the first wall then the per-wall LIFT walked into
 * the Z limit): the per-wall RETREAT was an incremental G0 Z#17/#19 lift → it now retracts to the DECLARED MACHINE MARGIN via
 * G53 (limit-proof, absolute), and the sim preview models that mid-program G53 (t826) so the passes still anchor to their own
 * starts. The reposition DROP value survives but now DESCENDS from the margin. REAL MACHINE MOTION — byte-parity-AFFECTING.
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
      // t824/t826 — the per-wall RETREAT is now the machine-frame G53 retract (register #520 on Expert); the OLD incremental
      // safeZ/#17 per-wall LIFT is RETIRED. The reposition DROP value survives (it now descends FROM the machine margin).
      retreatG53: /^G53 Z#520$/m.test(offAuto),                            // the per-wall retreat is the machine-frame margin → true
      offAutoLift19: /^G0 Z#19$/m.test(offAuto),                            // the OLD incremental safeZ per-wall lift is GONE on the off path → false
      offAutoDropNeg19: /^G0 Z\[0-#19\]$/m.test(offAuto),                   // the reposition drop [0-#19] survives (now descends from the margin) → true
      offAutoDrop18: /^G0 Z#18$/m.test(offAuto),                            // no #18 on the off path (drop is [0-#19]) → false
      onAutoLift17: /^G0 Z#17$/m.test(onAuto),                             // the OLD incremental #17 per-wall lift is GONE → false
      onAutoDrop18: /^G0 Z#18$/m.test(onAuto),                             // probeZ-ON reposition still drops #18 → true (unchanged)
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
  // (6) the reposition DROP value survives (it now descends FROM the margin — no longer the round-trip inverse of the retired lift).
  expect(r.offAutoDropNeg19, 'probeZ-off AUTO: the reposition drop [0-#19] survives (now descends from the margin)').toBe(true);
  expect(r.offAutoDrop18, 'probeZ-off AUTO: NO G0 Z#18 on the off travel path (drop is [0-#19])').toBe(false);
  expect(r.onAutoDrop18, 'probeZ-ON: the reposition still drops #18 (unchanged)').toBe(true);
});
