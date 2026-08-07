import { test, expect } from '@playwright/test';

// PHASE 3 — the ②-AIM handle: the MIDDLE wizard's feature canvas renders the per-pass start markers ①②③④ as DRAGGABLE
// POINT handles. Unlike Edge's vector (which wrote FORM fields), a drag here writes the SIM-ONLY DECLARED value
// (userStarts[p]) via the SAME panel.onStartDrag seam the 2D/3D markers use → computePassStarts → the trace AND the engine.
// COHERENCE (verify-real-symptom): drag ② → the probe pass BEGINS there (engine._passStarts follows), not just the canvas.
test.use({ viewport: { width: 1280, height: 900 } });

test('drag ② on the feature canvas → the probe pass follows (engine + markers) and persists', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsInteractive === '1');
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
  await page.waitForSelector('#wiz_middle', { state: 'visible' });

  // boss probe-both AUTO → 2 per-pass starts ①②, default stock
  await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); if (!e) return; if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('m_type', 'boss'); set('m_both', true);
    if (document.getElementById('m_inaxis')) set('m_inaxis', 'auto');
    if (document.getElementById('m_transaxis')) set('m_transaxis', 'auto');
    if (document.getElementById('m_dir')) set('m_dir', 'pos');
    if (document.getElementById('m_dir2')) set('m_dir2', 'neg');
    const stk = window.ddcsGetSettings().stock; stk.x = 100; stk.y = 80; stk.z = 20; stk.shape = 'boss'; stk.show = true;
    window.ddcsStudio.wizardManager.update();
  });

  // two draggable POINT handles + the engine's per-pass starts populated (the preview auto-plays)
  await page.waitForFunction(() => {
    const h = document.querySelectorAll('#middleLayoutCanvas .fc-handle-move');
    const p = window.ddcsStudio.wizardManager._activePanel;
    return h.length === 2 && p && p.engine && p.engine._passStarts && p.engine._passStarts.length === 2;
  });

  const before = await page.evaluate(() => {
    const svg = document.querySelector('#middleLayoutCanvas svg').getBoundingClientRect();
    const h = [...document.querySelectorAll('#middleLayoutCanvas .fc-handle-move')][1];   // ②
    const eng = window.ddcsStudio.wizardManager._activePanel.engine;
    return { cx: svg.left + (+h.getAttribute('x') + 6), cy: svg.top + (+h.getAttribute('y') + 6), engX: Math.round(eng._passStarts[1].x) };
  });

  // DRAG ② to the RIGHT (+world X) on the feature canvas
  await page.mouse.move(before.cx, before.cy);
  await page.mouse.down();
  await page.mouse.move(before.cx + 70, before.cy, { steps: 6 });
  await page.mouse.up();

  // the engine's ②.x followed the drag (the probe pass now BEGINS at the new spot)
  await page.waitForFunction((bx) => {
    const eng = window.ddcsStudio.wizardManager._activePanel.engine;
    return eng && eng._passStarts && eng._passStarts.length === 2 && Math.round(eng._passStarts[1].x) > bx + 3;
  }, before.engX);

  const after = await page.evaluate(() => {
    const eng = window.ddcsStudio.wizardManager._activePanel.engine;
    return { engX: Math.round(eng._passStarts[1].x), engStart0X: Math.round(eng._passStarts[0].x) };
  });
  expect(after.engX, 'engine ②.x followed the drag (the probe pass begins where dragged)').toBeGreaterThan(before.engX);

  // PERSIST: a re-render (a param edit that does NOT move pass 1) keeps ② at the dragged spot — userStarts[1] is locked.
  const persisted = await page.evaluate((draggedX) => {
    // toggle a sim-only field (the diag-travel) → wizard update → re-render; ② must NOT snap back to its inferStarts hint
    const e = document.getElementById('m_diag_travel'); if (e) { e.value = '45'; e.dispatchEvent(new Event('change', { bubbles: true })); }
    window.ddcsStudio.wizardManager.update();
    const eng = window.ddcsStudio.wizardManager._activePanel.engine;
    return Math.round(eng._passStarts[1].x);
  }, after.engX);
  expect(persisted, 'the dragged ② persists across a re-render (userStarts locks it)').toBe(after.engX);
});
