import { test, expect } from '@playwright/test';

/**
 * ISSUE 3 (shipped V10.84, human t382) — the stock modal's 3D depth pane updated its mesh on edit (render3d→setStock) but
 * did NOT re-paint until a viewcube/orbit interaction fired a frame: the modal viz runs with _animOn=false (no render LOOP),
 * and setStock does not call render(), so a dimension/pocket edit only re-drew when a datum/shape change hit fitAll (which
 * renders) — a plain X/Y/Z tweak lagged. FIX: render3d forces viz.render() after setStock when it does NOT re-fit → the 3D
 * repaints LIVE on every edit. VERIFY (real-symptom): a dimension edit fires a MODAL render frame (spy scoped to #se_3d).
 */
test.use({ viewport: { width: 1200, height: 900 } });
test('stock modal 3D repaints LIVE on a dimension edit (no viewcube nudge)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsOpenStock && window.ddcsGetSettings);

  // spy on GcodeViz3D.render, counting ONLY the MODAL viz (its container lives inside #se_3d after re-parent)
  await page.evaluate(async () => {
    const { GcodeViz3D } = await import('/viz/gcodeViz3d.js');
    if (!GcodeViz3D.prototype.__rcSpied) {
      const orig = GcodeViz3D.prototype.render;
      GcodeViz3D.prototype.render = function () { try { if (this.container && this.container.closest && this.container.closest('#se_3d')) window.__modalRc = (window.__modalRc || 0) + 1; } catch (_) {} return orig.apply(this, arguments); };
      GcodeViz3D.prototype.__rcSpied = true;
    }
  });
  await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'boss', show: true } }); });
  await page.evaluate(() => window.ddcsOpenStock());
  await page.waitForSelector('#se_3d', { state: 'visible', timeout: 6000 });
  await page.waitForTimeout(500);

  // DIMENSION edit (Z — no datum/shape change → render3d does NOT re-fit) → the fix forces a frame
  const dim = await page.evaluate(() => new Promise((res) => {
    window.__modalRc = 0;
    const z = document.querySelector('#se_z');
    z.value = String((+z.value || 20) + 7);
    z.dispatchEvent(new Event('input', { bubbles: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => res(window.__modalRc)));
  }));
  // SHAPE change (still repaints — via fitAll) as a control
  const shape = await page.evaluate(() => new Promise((res) => {
    window.__modalRc = 0;
    const s = document.querySelector('#se_shape');
    if (s) { s.value = s.value === 'pocket' ? 'boss' : 'pocket'; s.dispatchEvent(new Event('change', { bubbles: true })); }
    requestAnimationFrame(() => requestAnimationFrame(() => res(window.__modalRc)));
  }));
  await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/stock_modal_3d_refresh.png' }).catch(() => {});

  expect(dim, 'a DIMENSION (Z) edit forces a modal-3D render frame → LIVE repaint (no viewcube nudge — the issue-3 fix)').toBeGreaterThan(0);
  expect(shape, 'a shape change also repaints (via fitAll)').toBeGreaterThan(0);
});
