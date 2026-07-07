import { test, expect } from '@playwright/test';

/**
 * ROTARY CENTRELINE PORT E4 — the rig decouple (sim-device layer; sim-only, emit byte-identical).
 *
 * The 4th-axis RIG (chuck + tailstock) used to be built/disposed INLINE inside setStock and rebuilt by
 * setRotaryFixture calling a full setStock — entangled with the stock. E4 extracts it into setRotaryRig
 * (mirrors setMagazine's dispose/guard/build shape) BUT keeps the rig group a CHILD of _partGroup (NOT
 * this.scene like the magazine) so it inherits the part SPIN (_applyPartRotation) + the datum/WCS placement.
 *
 * VERIFY the real symptom on the actual rotary_center preview:
 *  1. the rig STILL renders (_rotaryFixture is built),
 *  2. it is a CHILD of _partGroup — NOT a direct child of the scene (the scout RISK: scene-attach = spin-loss),
 *  3. it SPINS with the part (rotating _partGroup rotates the rig's world transform),
 *  4. toggling the rig off/on no longer rebuilds the STOCK mesh (the decouple — same stockMesh identity),
 *  5. a stock change RE-DERIVES the rig (still a child of _partGroup),
 *  6. emit stays BYTE-IDENTICAL (the rig is a sim-device — no emit).
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('E4: the rotary rig is a decoupled sim-device — child of _partGroup, spins with the part, no stock rebuild on toggle', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);

  await page.evaluate(() => window.ddcsStudio.wizardManager.open('rotary_center'));
  await page.waitForSelector('#wiz_rotary_center', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz._partGroup; });
  await page.waitForTimeout(400);   // let the first preview render + apply the rotary-fixture hint

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    // (1) the rig renders + (2) it is a CHILD of _partGroup (not the scene)
    const rig = viz._rotaryFixture;
    const built = !!rig;
    const parentIsPartGroup = built && rig.parent === viz._partGroup;
    const notSceneChild = built && !viz.scene.children.includes(rig);

    // (3) it SPINS with the part — rotate _partGroup and the rig's world matrix must change
    viz._partGroup.updateMatrixWorld(true);
    const beforeE = rig ? rig.matrixWorld.elements.slice() : [];
    viz._applyPartRotation(37, 0);   // manual A-jog 37 deg
    viz._partGroup.updateMatrixWorld(true);
    const afterE = rig ? rig.matrixWorld.elements.slice() : [];
    const spun = built && beforeE.some((v, i) => Math.abs(v - afterE[i]) > 1e-6);
    viz._applyPartRotation(0, 0);    // back to rest

    // (4) toggling the rig off/on does NOT rebuild the STOCK mesh (the decouple: same object identity)
    const stockBefore = viz.stockMesh;
    viz.setRotaryFixture(false);
    const rigGoneOnOff = !viz._rotaryFixture;                 // toggle OFF disposes the rig
    const stockSameAfterOff = viz.stockMesh === stockBefore;  // ...without touching the stock mesh
    viz.setRotaryFixture(true);
    const rigBackOnToggle = !!viz._rotaryFixture && viz._rotaryFixture.parent === viz._partGroup;
    const stockSameAfterOn = viz.stockMesh === stockBefore;

    // (5) a stock change RE-DERIVES the rig (still a child of _partGroup)
    viz.setStock({ x: 160, y: 60, z: 60, shape: 'cylinder', show: true });
    const rigRederived = !!viz._rotaryFixture && viz._rotaryFixture.parent === viz._partGroup && viz._rotaryFixture !== rig;

    return { built, parentIsPartGroup, notSceneChild, spun, rigGoneOnOff, stockSameAfterOff, rigBackOnToggle, stockSameAfterOn, rigRederived };
  });

  expect(r.built, 'the 4th-axis rig still renders on the rotary sim').toBe(true);
  expect(r.parentIsPartGroup, 'the rig is a CHILD of _partGroup (inherits spin + datum/WCS placement)').toBe(true);
  expect(r.notSceneChild, 'the rig is NOT a direct child of the scene (scout RISK: scene-attach = spin-loss)').toBe(true);
  expect(r.spun, 'rotating _partGroup rotates the rig with the part (it spins)').toBe(true);
  expect(r.rigGoneOnOff, 'toggling the rig OFF disposes it').toBe(true);
  expect(r.stockSameAfterOff, 'toggling the rig OFF does NOT rebuild the stock mesh (decoupled from setStock)').toBe(true);
  expect(r.rigBackOnToggle, 'toggling the rig back ON re-builds it as a child of _partGroup').toBe(true);
  expect(r.stockSameAfterOn, 'toggling the rig back ON still does NOT rebuild the stock mesh').toBe(true);
  expect(r.rigRederived, 'a stock change re-derives a fresh rig, still a child of _partGroup').toBe(true);
});

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
