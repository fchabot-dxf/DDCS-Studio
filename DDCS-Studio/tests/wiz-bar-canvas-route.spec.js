import { test, expect } from '@playwright/test';

/**
 * B3c — WIZ-BAR ROUTING (user-found gap, t18). Clicking a panel-declaring data-op in the wizard bar must open its
 * CANVAS/wizard path (FeatureCanvas + drag handle), not the plain quick-insert form. Corner (data) declares panel
 * 'form2d'; before the fix commandDeck routed EVERY kind:'user' entry to ddcsInsertUserOp (fields-only form), so the
 * canvas + drag the user built (B3/B3b) never showed via the door the user actually clicks.
 *
 * verify-real-symptom: this drives the USER's path — the RENDERED bar button's click — NOT openWiz directly (the B3
 * test used openWiz and passed while the bar stayed broken). It must FAIL pre-fix and PASS post-fix.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('B3c: clicking Corner (data) in the wiz-bar opens the FeatureCanvas + drag handle (not the plain form)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsRefreshWizardBar && window.ddcsGetBlockProgram);

  // register Corner (data) as a user op + refresh the bar so its entry renders (its panel is 'form2d')
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
    window.ddcsRefreshWizardBar();
  });

  // the USER's entrypoint: the rendered bar button (NOT openWiz). Read its routing + confirm the op declares form2d.
  const routing = await page.evaluate(async () => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { listUserOps } = await import('/blocks/userOps.js');
    const def = listUserOps().find((d) => d.opType === CD.CORNER_DATA_OPTYPE);
    const btn = Array.from(document.querySelectorAll('.dock-header button')).find((x) => /Corner \(data\)/.test(x.textContent || ''));
    return { panel: def && def.panel, onclick: btn ? (btn.getAttribute('onclick') || '') : null };
  });
  expect(routing.panel, 'Corner (data) declares the form2d canvas panel').toBe('form2d');
  expect(routing.onclick, 'the bar renders a Corner (data) entry').not.toBeNull();
  // ROUTING FIX: a form2d data-op routes to the canvas/wizard path (openWiz), NOT the plain quick-insert form.
  expect(routing.onclick, 'Corner (data) routes to openWiz (the canvas/wizard path)').toContain('openWiz');
  expect(routing.onclick, 'Corner (data) does NOT route to the plain quick-insert form').not.toContain('ddcsInsertUserOp');

  // CLICK the actual rendered bar button (the real user gesture — fires its onclick, dropdown visibility aside).
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.dock-header button')).find((x) => /Corner \(data\)/.test(x.textContent || ''));
    btn.click();
  });

  // verify-real-symptom: the 2D FeatureCanvas + a draggable move handle RENDER (the exact gap the user hit).
  await page.waitForSelector('#userVizContainer .fc-handle-move', { state: 'visible', timeout: 6000 });
  const ok = await page.evaluate(() => {
    const c = document.getElementById('userVizContainer');
    return { canvasVisible: !!c && c.offsetParent !== null, hasHandle: !!(c && c.querySelector('.fc-handle-move')), hasStock: !!(c && c.querySelector('.fc-stock')) };
  });
  expect(ok.canvasVisible, 'the 2D FeatureCanvas pane is visible after the bar click').toBe(true);
  expect(ok.hasHandle, 'the reposition drag handle (.fc-handle-move) rendered via the bar path').toBe(true);
  expect(ok.hasStock, 'the stock rect rendered').toBe(true);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
