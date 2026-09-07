import { test, expect } from './support/harness.mjs';

/**
 * ROTARY CENTRELINE PORT E4 — the emit-identity half of the rig decouple (sim-device layer; sim-only, emit
 * byte-identical). Split off tests/rotary-center-rig-decouple.spec.js (tier migration): this assertion never
 * touches the sim/Three.js rig at all — it is a pure emit comparison. The other test in that file (the rig
 * itself: `_partGroup` parenting, spin, stock-rebuild decoupling) drives a real Three.js viz and stays in
 * tests/rotary-center-rig-decouple-drive.spec.js.
 */
test('E4: emit stays byte-identical (the rig is a sim-device — no emit)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const same = await page.evaluate(async () => {
    const { rotaryCenterDataDef, ROTARY_CENTER_DEFAULTS } = await import('/blocks/dataOps/rotaryCenterData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
    registerUserOp(rotaryCenterDataDef());
    const known = emitMapped(builderOf('user_rotary_center_data')({ ...ROTARY_CENTER_DEFAULTS })).text === emitMapped(rotaryCenterStack({ ...ROTARY_CENTER_DEFAULTS })).text;
    const fit = emitMapped(builderOf('user_rotary_center_data')({ ...ROTARY_CENTER_DEFAULTS, method: 'fit' })).text === emitMapped(rotaryCenterStack({ ...ROTARY_CENTER_DEFAULTS, method: 'fit' })).text;
    return known && fit;
  });
  expect(same, 'the E4 rig decouple changes nothing in the emitted G-code (sim-only)').toBe(true);
});
