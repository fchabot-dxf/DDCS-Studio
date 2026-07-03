import { test, expect } from '@playwright/test';

/**
 * ITEM-2 — GUI CORNER-SELECTOR (t112, the last corner task). The 4 stock corners on the Layout FeatureCanvas become
 * clickable ring targets (FeatureCanvas._drawCornerPick, FL=min-XY … BR=max-XY). Clicking one SETS the `corner` <select>
 * + dispatches change → update() re-emits (already correct per corner) + re-derives the per-corner markers/sim (prefill
 * t109). A spatial GUI pick augmenting the Corner dropdown (prefer-gui-over-fields / spatial-gui-form-vs-canvas). The
 * click drives the REAL onchange seam → real-symptom: the EMITTED dog-leg + markers follow, independent-truth per corner.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// per corner (YX): the emitted reposition #23/#24 — #15=+td, #16=−td; #23=opp(xd), #24=own(yd). Independent truth.
const EMIT = { FL: ['#16', '#15'], FR: ['#15', '#15'], BL: ['#16', '#16'], BR: ['#15', '#16'] };
// per corner: the declared wall-1/wall-2 sim markers (prefill t109), so we prove the MARKERS follow the pick too.
const MARK = {
  FL: [[7, -43], [-43, 7]], FR: [[93, -43], [143, 7]], BL: [[7, 123], [-43, 73]], BR: [[93, 123], [143, 73]],
};

test('the 4 stock-corner pick targets render on the Layout canvas; the current corner is highlighted', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#userVizContainer .fc-corner-pick', { state: 'visible' });
  const info = await page.evaluate(() => {
    const picks = [...document.querySelectorAll('#userVizContainer .fc-corner-pick')];
    return { codes: picks.map((p) => p.getAttribute('data-corner')).sort(), cur: (picks.find((p) => p.classList.contains('fc-corner-pick-cur')) || {}).getAttribute && picks.find((p) => p.classList.contains('fc-corner-pick-cur')).getAttribute('data-corner') };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  expect(info.codes, 'all 4 stock corners are clickable targets').toEqual(['BL', 'BR', 'FL', 'FR']);
  expect(info.cur, 'the current corner (FL default) is highlighted').toBe('FL');
});

test('clicking each stock corner SETS the corner param → the emit dog-leg + the sim markers follow (independent truth)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#userVizContainer .fc-corner-pick', { state: 'visible' });

  const readState = () => page.evaluate(() => {
    const sel = [...document.querySelectorAll('#wiz_user_form select')].find((s) => [...s.options].some((o) => o.value === 'BR'));
    const box = document.getElementById('userViz3dContainer');
    const host = box && box.parentElement && box.parentElement.querySelector('.wiz-viz3d');
    const g = (host && host.__gcode) || '';
    const m = (v) => (g.match(new RegExp('#' + v + '\\s*=\\s*([^\\n(]+)')) || [])[1];
    const cur = (document.querySelector('#userVizContainer .fc-corner-pick-cur') || {}).getAttribute
      && document.querySelector('#userVizContainer .fc-corner-pick-cur').getAttribute('data-corner');
    return { cornerSel: sel && sel.value, curPick: cur, g23: (m(23) || '').trim(), g24: (m(24) || '').trim() };
  });
  const markers = () => page.evaluate(async () => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const sel = [...document.querySelectorAll('#wiz_user_form select')].find((s) => [...s.options].some((o) => o.value === 'BR'));
    const stock = window.ddcsGetSettings().stock;
    const def = CD.cornerDataDef();
    return def.simStartsProvider({ ...CD.CORNER_DEFAULTS, corner: sel.value }, stock).map((r) => [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10]);
  });

  // click AROUND the corners (incl. back to FL) — proves the pick SETS + the emit/markers TRACK, not stick
  for (const c of ['BR', 'FR', 'BL', 'FL', 'BR']) {
    await page.locator(`#userVizContainer .fc-corner-pick[data-corner="${c}"]`).click();
    await page.waitForTimeout(150);
    const s = await readState();
    expect(s.cornerSel, `click ${c} → the corner <select> = ${c}`).toBe(c);
    expect(s.curPick, `click ${c} → the ${c} target is now highlighted (current)`).toBe(c);
    expect([s.g23, s.g24], `click ${c} → the emitted dog-leg #23/#24 = ${JSON.stringify(EMIT[c])}`).toEqual(EMIT[c]);
    expect(await markers(), `click ${c} → the sim markers follow to the ${c} chain`).toEqual(MARK[c]);
  }
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
