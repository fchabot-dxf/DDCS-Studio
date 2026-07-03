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
    return {
      offAutoBefore: beforeFirstWallG31(emit({})),                          // probeZ-off auto: what precedes wall-1's G31?
      onAutoBefore: beforeFirstWallG31(emit({ probeZFirst: 1 })),           // probeZ-on auto: ...
      offManualHasZ18: /^G0 Z#18$/m.test(emit({ travelApproach: 'manual' })),  // probeZ-off manual: ANY G0 Z#18? (no plunge + no drop → false)
      offAutoHasZ18: /^G0 Z#18$/m.test(emit({})),                            // probeZ-off auto: the reposition drop REMAINS → true
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
  // ...but the AUTO-OFF reposition drop REMAINS (it round-trips the tool back to the jogged depth for wall-2).
  expect(r.offAutoHasZ18, 'probeZ-off AUTO: the reposition drop G0 Z#18 REMAINS (round-trip to jogged depth)').toBe(true);
});
