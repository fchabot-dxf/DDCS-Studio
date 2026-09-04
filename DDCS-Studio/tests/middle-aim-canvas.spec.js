import { test, expect } from '@playwright/test';

// PHASE 3 — the ②-AIM handle: the MIDDLE wizard's feature canvas renders the per-pass start markers ①②③④ as DRAGGABLE
// POINT handles. Unlike Edge's vector (which wrote FORM fields), a drag here writes the SIM-ONLY DECLARED value
// (userStarts[p]) via the SAME panel.onStartDrag seam the 2D/3D markers use → computePassStarts → the trace AND the engine.
// COHERENCE (verify-real-symptom): drag ② → the probe pass BEGINS there (engine._passStarts follows), not just the canvas.
test.use({ viewport: { width: 1280, height: 900 } });

test('drag ② on the feature canvas → the probe pass follows (engine + markers) and persists', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsInteractive === '1');
  // t1730 — 'middle' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_middle_data'));
  await page.waitForSelector('#wiz_user', { state: 'visible' });

  // boss probe-both AUTO → 2 per-pass starts ①②, default stock. t1730 — old m_* ids retired; the twin's generic
  // form renders every declared param as [data-param="<name>"] (middleData.js MIDDLE_BINDING_SPECS).
  await page.evaluate(() => {
    const set = (param, v) => { const e = document.querySelector(`[data-param="${param}"]`); if (!e) return; if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('featureType', 'boss'); set('twoAxis', true);
    if (document.querySelector('[data-param="inAxis"]')) set('inAxis', 'auto');
    if (document.querySelector('[data-param="transAxis"]')) set('transAxis', 'auto');
    if (document.querySelector('[data-param="dir1"]')) set('dir1', 'pos');
    if (document.querySelector('[data-param="dir2"]')) set('dir2', 'neg');
    const stk = window.ddcsGetSettings().stock; stk.x = 100; stk.y = 80; stk.z = 20; stk.shape = 'boss'; stk.show = true;
    window.ddcsStudio.wizardManager.update();
  });

  // t1730 port note — the twin's marker CLASSIFICATION changed from the old view (not a selector bug): ① (the
  // sim-only pass-0 start) now renders `fc-handle-sim` (declared circle-glyph, panelTypes.js SIM_ID='__simstart0'),
  // and ② (the auto trans-axial landing) renders `fc-handle-move` (declared square-glyph, panelTypes.js
  // `{ type:'diagAim', id:'diagAim', label:'②' }`) — a STABLE `data-hid` identifies each by its bound source
  // (panelTypes.js comment t122), not by class/position. ② is the handle this test drags.
  await page.waitForFunction(() => {
    const h = document.querySelector('[id*="userVizContainer"]:has([data-hid], .fc-handle) [data-hid="diagAim"]');
    const p = window.ddcsStudio.wizardManager._activePanel;
    const starts = p && typeof p.getPassStarts === 'function' ? p.getPassStarts() : null;
    return !!h && starts && starts.length === 2;
  });
  // t2599 — the tree-mode canvas's own auto-fit/rescale is still transitional for ~1s right after a marker first
  // appears — reading geometry before it settles targets a stale, still-shrinking layout.
  await page.waitForTimeout(1000);

  const before = await page.evaluate(() => {
    const svg = document.querySelector('[id*="userVizContainer"]:has([data-hid], .fc-handle) svg').getBoundingClientRect();
    const h = document.querySelector('[id*="userVizContainer"]:has([data-hid], .fc-handle) [data-hid="diagAim"]');
    const starts = window.ddcsStudio.wizardManager._activePanel.getPassStarts();
    return { cx: svg.left + (+h.getAttribute('x') + 6), cy: svg.top + (+h.getAttribute('y') + 6), engX: Math.round(starts[1].x) };
  });

  // DRAG ② to the RIGHT (+world X) on the feature canvas
  await page.mouse.move(before.cx, before.cy);
  await page.mouse.down();
  await page.mouse.move(before.cx + 70, before.cy, { steps: 6 });
  await page.mouse.up();

  // the pass-start ②.x followed the drag (the probe pass now BEGINS at the new spot)
  await page.waitForFunction((bx) => {
    const starts = window.ddcsStudio.wizardManager._activePanel.getPassStarts();
    return starts && starts.length === 2 && Math.round(starts[1].x) > bx + 3;
  }, before.engX);

  const after = await page.evaluate(() => {
    const starts = window.ddcsStudio.wizardManager._activePanel.getPassStarts();
    return { engX: Math.round(starts[1].x), engStart0X: Math.round(starts[0].x) };
  });
  expect(after.engX, 'the pass-start ②.x followed the drag (the probe pass begins where dragged)').toBeGreaterThan(before.engX);

  // PERSIST: a re-render (a param edit that does NOT move pass 1) keeps ② at the dragged spot — userStarts[1] is locked.
  const persisted = await page.evaluate((draggedX) => {
    // toggle a sim-only field (the diag-travel) → wizard update → re-render; ② must NOT snap back to its inferStarts hint
    const e = document.querySelector('[data-param="diagTravel"]'); if (e) { e.value = '45'; e.dispatchEvent(new Event('change', { bubbles: true })); }
    window.ddcsStudio.wizardManager.update();
    const starts = window.ddcsStudio.wizardManager._activePanel.getPassStarts();
    return Math.round(starts[1].x);
  }, after.engX);
  expect(persisted, 'the dragged ② persists across a re-render (userStarts locks it)').toBe(after.engX);
});
