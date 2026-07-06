import { test, expect } from '@playwright/test';

/**
 * WORKPIECE PIVOT — M2 amendments (human t356):
 *  (1) DATUM COHERENCE — the modal's 2D top-view part-zero crosshair follows the selected datum corner (was pinned to
 *      the min-XY corner regardless), matching the 3D. workpieceBackdrop().origin = datumXY, and FeatureCanvas draws the
 *      crosshair there. ASSERT-THE-VALUE: origin == the datum corner across datums.
 *  (2) the redundant 'Show stock in 3D' checkbox is REMOVED (the modal has its own 3D pane); editing forces show:true so
 *      the stock never gets stuck hidden in the main 3D.
 */
test.use({ viewport: { width: 1200, height: 900 } });

test('M2 amendments: the top-view crosshair follows the datum; the Show-in-3D control is gone (show forced true)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsOpenStock);

  // ── (1) PURE — the backdrop origin (crosshair) sits at the datum corner ──
  const origins = await page.evaluate(async () => {
    const { projectWorkpiece, workpieceBackdrop } = await import('/engine/workpiece.js');
    const bd = (d) => workpieceBackdrop(projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'boss', datum: d })).origin;
    return { nnp: bd('nnp'), ppp: bd('ppp'), ccp: bd('ccp'), pnp: bd('pnp') };
  });
  expect(origins.nnp, 'front-left datum → crosshair at min-XY').toEqual({ x: 0, y: 0 });
  expect(origins.ppp, 'back-right datum → crosshair at max-XY').toEqual({ x: 100, y: 80 });
  expect(origins.ccp, 'centre datum → crosshair at the block centre').toEqual({ x: 50, y: 40 });
  expect(origins.pnp, 'front-right datum → crosshair at max-X / min-Y').toEqual({ x: 100, y: 0 });

  // ── (2) REAL-SYMPTOM — no Show-in-3D checkbox; editing forces show:true even if it started hidden ──
  const snapshot = await page.evaluate(async () => {
    const SP = await import('/ui/settingsPanel.js');
    const snap = localStorage.getItem('ddcs_studio_settings');
    SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'boss', show: false, datum: 'nnp', pin: 'origin' } });   // start HIDDEN
    window.ddcsOpenStock();
    return snap;
  });
  await page.waitForSelector('#se_canvas', { state: 'visible', timeout: 5000 });

  const chk = await page.evaluate(() => {
    const x = document.querySelector('#se_x'); x.value = '110'; x.dispatchEvent(new Event('input', { bubbles: true }));   // any edit → commit()
    return { hasShowCheckbox: !!document.querySelector('#se_show'), show: window.ddcsGetSettings().stock.show };
  });
  expect(chk.hasShowCheckbox, "the 'Show stock in 3D' checkbox was removed").toBe(false);
  expect(chk.show, 'editing forces show:true (the stock is never stuck hidden in the main 3D)').toBe(true);

  // ── eyeball: reopen on a CENTRE-datum pocket → the crosshair + the 3D origin sit at the block centre (matches the main 3D) ──
  await page.evaluate(async () => {
    const SP = await import('/ui/settingsPanel.js');
    SP.applySettings({ stock: { x: 120, y: 90, z: 20, shape: 'pocket', show: true, datum: 'ccp', pin: 'origin', features: [] } });
    window.ddcsOpenStock();   // openStockEditor closes any prior + reopens fresh, reading the centre datum
  });
  await page.waitForSelector('#se_canvas svg', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
  await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/stock_modal_datum.png' });

  await page.evaluate((snap) => { const K = 'ddcs_studio_settings'; if (snap != null) localStorage.setItem(K, snap); else localStorage.removeItem(K); }, snapshot);
});
