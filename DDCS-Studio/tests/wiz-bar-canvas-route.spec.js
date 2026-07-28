import { test, expect } from '@playwright/test';

/**
 * B3c + B3d — WIZ-BAR ROUTING & the 3D+2D combo (user-found, t18/t22). Clicking a panel-declaring data-op in the
 * wizard bar must open its CANVAS/wizard path — and, for a form3d+2d op, show BOTH the 3D sim (+ declared per-pass
 * markers) AND the 2D drag canvas TOGETHER (the built-in probe pattern), not the plain quick-insert form and not
 * either/or. Corner (data) declares panel 'form3d+2d'. B3c: commandDeck routed EVERY kind:'user' entry to
 * ddcsInsertUserOp (fields-only form). B3d: userOpView was EITHER/OR (form2d hid the 3D pane → CORNER_SIM_STARTS
 * markers orphaned).
 *
 * verify-real-symptom: this drives the USER's path — the RENDERED bar button's click — NOT openWiz directly.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('B3c/B3d: clicking the IN-PLACE Corner slot in the wiz-bar opens the twin — BOTH the 3D sim and the 2D drag canvas (not the plain form)', async ({ page }) => {
  // t1303 — THIS SPEC CONTROLS ITS OWN STATE. It passed inside a full run while failing alone, which means its result
  // depended on what an earlier spec happened to leave behind — and that masked a real loss of the corner canvas's drag
  // handles for several turns. A spec that needs an accidental inheritance is not testing what it says it tests.
  await page.addInitScript(() => {
    try { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_machine'); localStorage.removeItem('ddcs_panes'); } catch (_) {}
  });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsRefreshWizardBar && window.ddcsGetBlockProgram);   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
  // …a MILL workspace, declared, because the corner probe is a mill op and a lathe workspace greys it (t1301)
  await page.evaluate(async () => { const M = await import('/data/workspaceMachine.js'); M.setMachine({ kind: 'mill' }, false); });

  // register Corner (data) as a user op + refresh the bar. t339 E4 — its OWN entry is hidden; the built-in 'Corner' Probe slot
  // `opensAs` it (in-place). So the USER clicks the 'Corner' slot, which routes openWiz('user_corner_data') → the canvas view.
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
    window.ddcsRefreshWizardBar();
  });

  // the USER's entrypoint: the rendered IN-PLACE 'Corner' bar button (NOT openWiz directly). Read its routing + the panel.
  const routing = await page.evaluate(async () => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { listUserOps } = await import('/blocks/userOps.js');
    const def = listUserOps().find((d) => d.opType === CD.CORNER_DATA_OPTYPE);
    const btn = Array.from(document.querySelectorAll('.dock-header button')).find((x) => /Corner/.test(x.textContent || ''));
    return { panel: def && def.panel, onclick: btn ? (btn.getAttribute('onclick') || '') : null };
  });
  expect(routing.panel, 'Corner (data) declares the form3d+2d canvas panel (3D sim + 2D drag)').toBe('form3d+2d');
  expect(routing.onclick, 'the bar renders the in-place Corner entry').not.toBeNull();
  // t339 E4 — the in-place Corner slot opensAs the twin: openWiz('user_corner_data'), the canvas/wizard path (NOT the plain form).
  expect(routing.onclick, 'the Corner slot routes to openWiz (the canvas/wizard path)').toContain("openWiz && openWiz('user_corner_data')");
  expect(routing.onclick, 'the Corner slot does NOT route to the plain quick-insert form').not.toContain('ddcsInsertUserOp');

  // CLICK the actual rendered bar button (the real user gesture — fires its onclick, dropdown visibility aside).
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.dock-header button')).find((x) => /Corner/.test(x.textContent || ''));
    btn.click();
  });

  // verify-real-symptom (B3d): BOTH the 2D drag handle AND the 3D sim pane RENDER TOGETHER (never either/or).
  await page.waitForSelector('#userVizContainer .fc-handle-move', { state: 'visible', timeout: 6000 });
  await page.waitForSelector('#userViz3dBox .wiz-viz3d', { state: 'visible', timeout: 6000 });
  const ok = await page.evaluate(async () => {
    const c = document.getElementById('userVizContainer');
    const box3d = document.getElementById('userViz3dBox');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const starts = opSimStarts(CD.CORNER_DATA_OPTYPE, CD.CORNER_DEFAULTS, window.ddcsGetSettings().stock) || [];
    return {
      canvas2dVisible: !!c && c.offsetParent !== null,
      hasHandle: !!(c && c.querySelector('.fc-handle-move')),
      hasStock: !!(c && c.querySelector('.fc-stock')),
      viz3dVisible: !!box3d && box3d.offsetParent !== null && !!box3d.querySelector('.wiz-viz3d'),
      markerCount: starts.length,
    };
  });
  expect(ok.hasHandle, 'the 2D reposition drag handle (.fc-handle-move) rendered via the bar path').toBe(true);
  expect(ok.hasStock, 'the 2D stock rect rendered').toBe(true);
  expect(ok.canvas2dVisible, 'the 2D FeatureCanvas pane is visible').toBe(true);
  expect(ok.viz3dVisible, 'the 3D sim pane (.wiz-viz3d) renders + is visible TOGETHER with the 2D canvas — NOT either/or (the B3d fix)').toBe(true);
  expect(ok.markerCount, 'the declared per-pass sim-start markers (wall-1 + wall-2) are fed to the 3D preview').toBeGreaterThanOrEqual(2);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
