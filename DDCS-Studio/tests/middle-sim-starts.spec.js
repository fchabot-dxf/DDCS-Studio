import { test, expect } from '@playwright/test';

/**
 * MIDDLE PORT E2 — the sim-starts provider. def.simStartsProvider (middleSimStartsProvider) PORTS BUILT_IN.middle: the
 * per-pass preview markers of the "Middle (data)" twin must equal the built-in middle inference (opSimStarts('middle'))
 * in POSITION and COUNT, and the count MUST mirror the macro's reposition() calls (length == 1 + the 'REPOSITION:' count).
 * ASSERT-THE-VALUE vs an INDEPENDENT truth (opSimStarts('middle') + the emitted macro), not just "markers appear".
 * Sim-only → the emit is untouched (the E0/E1 goldens stay green).
 */
test('E2: middle twin sim-starts == BUILT_IN.middle positions+count; pass count == 1 + macro REPOSITION count', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { middleDataDef, MIDDLE_DATA_OPTYPE } = await import('/blocks/dataOps/middleData.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(middleDataDef());

    // sweep the params BUILT_IN.middle reads (featureType/inAxis/transAxis/twoAxis/circular/probeZ/dir1/dir2) × 3 stocks.
    // wcs/syncA don't affect the sim; dir1/dir2 flip the wall SIDES → included for position faithfulness.
    const FEATS = ['pocket', 'boss'], MODES = ['auto', 'manual'], BOOLS = [false, true], DIRS = ['pos', 'neg'];
    const stocks = [{ x: 100, y: 80, z: 20 }, { x: 140, y: 90, z: 30 }, { x: 60, y: 60, z: 10 }];
    const combos = [];
    for (const featureType of FEATS)
      for (const inAxis of MODES)
        for (const transAxis of MODES)
          for (const twoAxis of BOOLS)
            for (const circular of BOOLS)
              for (const probeZ of BOOLS)
                for (const dir1 of DIRS)
                  for (const dir2 of DIRS)
                    combos.push({ featureType, inAxis, transAxis, twoAxis, circular, probeZ, dir1, dir2 });

    const round = (v) => Math.round(v * 1000) / 1000;
    const posEq = (a, b) => a.length === b.length && a.every((m, i) => round(m.x) === round(b[i].x) && round(m.y) === round(b[i].y) && round(m.z) === round(b[i].z));
    const reposCount = (txt) => (txt.match(/REPOSITION:/g) || []).length;

    let posFails = 0, countFails = 0, firstPos = null, firstCount = null, maxLen = 0, minLen = 99;
    for (const stock of stocks) for (const c of combos) {
      const twin = opSimStarts(MIDDLE_DATA_OPTYPE, c, stock);   // the twin's declared provider
      const builtin = opSimStarts('middle', c, stock);          // BUILT_IN.middle — the INDEPENDENT truth
      if (!posEq(twin, builtin)) { posFails++; if (!firstPos) firstPos = { c, stock, twin, builtin }; }
      maxLen = Math.max(maxLen, twin.length); minLen = Math.min(minLen, twin.length);
      const rep = reposCount(emitMapped(middleStack(c)).text);   // the macro's reposition() count (independent)
      if (twin.length !== 1 + rep) { countFails++; if (!firstCount) firstCount = { c, passes: twin.length, rep }; }
    }

    // sample: the default (pocket) → ONE centre pass at (sx/2, sy/2, -min(5, sz/2))
    const sample = opSimStarts(MIDDLE_DATA_OPTYPE, {}, { x: 100, y: 80, z: 20 });
    return {
      comboCount: combos.length * stocks.length, posFails, countFails, firstPos, firstCount, maxLen, minLen,
      sampleLen: sample.length, sampleCentre: sample[0],
    };
  });

  expect(r.comboCount, 'the sweep is substantial (256 param combos × 3 stocks)').toBe(768);
  if (r.firstPos) console.log('POS DIFF @ ' + JSON.stringify({ c: r.firstPos.c, stock: r.firstPos.stock }) + '\ntwin:    ' + JSON.stringify(r.firstPos.twin) + '\nbuiltin: ' + JSON.stringify(r.firstPos.builtin));
  expect(r.posFails, 'the twin provider === BUILT_IN.middle POSITIONS across the full param×stock sweep').toBe(0);
  if (r.firstCount) console.log('COUNT DIFF @ ' + JSON.stringify(r.firstCount));
  expect(r.countFails, 'the sim-start pass COUNT == 1 + the macro REPOSITION count (markers mirror the macro passes)').toBe(0);
  expect(r.minLen, 'min 1 pass (pocket, no probe-Z)').toBe(1);
  expect(r.maxLen, 'max 5 passes (boss + twoAxis + in-axis manual + probe-Z)').toBe(5);
  expect(r.sampleLen, 'default (pocket) → 1 centre pass').toBe(1);
  expect(r.sampleCentre.x, 'centre X = sx/2').toBe(50);
  expect(r.sampleCentre.y, 'centre Y = sy/2').toBe(40);
});

/**
 * E2 screenshot — the middle preview renders the per-pass markers off the declared anchors. The built-in middle wizard
 * preview uses the SAME inference (opSimStarts('middle')) the twin's provider ports, so it faithfully shows the twin's
 * markers. Configure a boss / find-both / in-axis-manual so multiple markers are visible, then capture the modal.
 */
test('E2 screenshot: the middle preview renders the per-pass markers', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_middle_data'));
  await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 5000 });
  await page.evaluate(() => {
    const set = (sel, v) => { const e = document.querySelector(sel); if (e) { e.value = v; } };
    const check = (sel) => { const e = document.querySelector(sel); if (e) { e.checked = true; } };
    set('[data-param="featureType"]', 'boss'); check('[data-param="twoAxis"]'); set('[data-param="inAxis"]', 'manual'); set('[data-param="transAxis"]', 'manual');
    window.ddcsStudio.wizardManager.update();
  });
  await page.waitForTimeout(600);   // let the 3D preview rebuild + the markers place
  { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/middle_e2_preview.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
  await expect(page.locator('#wiz_user'), 'the middle wizard preview is visible').toBeVisible();
});
