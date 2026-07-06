import { test, expect } from '@playwright/test';

/**
 * WORKPIECE PIVOT — M1a: the STOCK MODAL gains a top-view WORKPIECE CANVAS (READ-ONLY this slice).
 *
 * workpieceBackdrop(wp) is the ONE-source FeatureCanvas spec { stock:{w,h,ox,oy}, items:[feature glyphs] },
 * its glyphs matching middleView.buildFeatureItems so the modal and every wizard preview draw the SAME thing.
 * ASSERT-THE-VALUE: the derived backdrop items sit at the geometrically-correct positions (independent truth);
 * REAL-SYMPTOM: opening the modal actually renders an fc-stock rect + the legacy pocket's fc-feature-pocket cavity.
 */

test('M1a: workpieceBackdrop items match the wizard glyphs; the modal canvas renders outer + legacy pocket', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsOpenStock);

  // ── (A) PURE workpieceBackdrop — INDEPENDENT-truth glyph positions (same formula middleView.buildFeatureItems draws) ──
  const bd = await page.evaluate(async () => {
    const { projectWorkpiece, workpieceBackdrop } = await import('/engine/workpiece.js');
    const boss   = workpieceBackdrop(projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'boss' }));
    const pocket = workpieceBackdrop(projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'pocket' }));
    const cyl    = workpieceBackdrop(projectWorkpiece({ x: 150, y: 76, z: 76, shape: 'cylinder' }));
    const none   = workpieceBackdrop(projectWorkpiece({ x: 0, y: 0, z: 0, shape: 'boss' }));   // no dims → no backdrop
    // OFFSET-AWARE: a DECLARED feature at an off-centre pos must render AT that pos (offset flows seam→backdrop→canvas)
    const offset = workpieceBackdrop(projectWorkpiece({
      x: 120, y: 90, z: 20, shape: 'boss',
      features: [{ id: 'p1', shape: 'rect', side: 'inside', pos: { x: 30, y: 20 }, size: { x: 20, y: 10 } }],
    }));
    return { boss, pocket, cyl, none, offset };
  });

  // outer backdrop = {w,h,ox,oy}; a boss synthesizes NO feature glyph (it IS the outer block)
  expect(bd.boss.stock, 'boss → the outer block backdrop').toEqual({ w: 100, h: 80, ox: 0, oy: 0 });
  expect(bd.boss.items, 'boss → no extra feature glyph (the outer is the workpiece)').toEqual([]);
  // legacy pocket 100×80: w=max(8,0.25·80)=20 → cavity rect {x:w, y:w, w:x-2w, h:y-2w} = {20,20,60,40}. This is EXACTLY
  // middleView.buildFeatureItems' pocket rect → the modal and the wizard draw the identical cavity.
  expect(bd.pocket.items, 'legacy pocket → fc-feature-pocket cavity at the 25% inset (matches the wizard glyph)').toEqual([
    { kind: 'rect', x: 20, y: 20, w: 60, h: 40, cls: 'fc-feature-pocket' },
  ]);
  // cylinder → round outer, no cavity → NO extra glyph (the outer IS the workpiece; the fc-stock rect shows it;
  // how a round OUTER renders top-down is a later refinement). outer.shape carries 'round' for downstream consumers.
  expect(bd.cyl.items, 'cylinder → no cavity glyph (outer shown by fc-stock)').toEqual([]);
  expect(bd.cyl.stock, 'cylinder → the outer backdrop').toEqual({ w: 150, h: 76, ox: 0, oy: 0 });
  expect(bd.none.stock, 'zero-dim stock → no backdrop').toBe(null);
  // OFFSET-AWARE: pos {30,20} + size {20,10} → rect at {30-10, 20-5} = {20,15} (NOT centered {60,45}) — offset flows through
  expect(bd.offset.items, 'a declared feature renders AT its pos (offset-aware, not centered)').toEqual([
    { kind: 'rect', x: 20, y: 15, w: 20, h: 10, cls: 'fc-feature-pocket' },
  ]);

  // ── (B) REAL-SYMPTOM — open the modal on a pocket stock; the canvas renders the outer rect + the cavity ──
  const shot = await page.evaluate(async () => {
    const SP = await import('/ui/settingsPanel.js');
    const KEY = 'ddcs_studio_settings';
    const snapshot = localStorage.getItem(KEY);
    SP.applySettings({ stock: { x: 120, y: 90, z: 20, shape: 'pocket', show: true } });
    window.ddcsOpenStock();
    return snapshot;
  });

  const canvas = page.locator('#se_canvas svg.feature-canvas');
  await expect(canvas, 'the modal mounts the FeatureCanvas').toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(300);   // let the rAF fit + draw settle

  const rendered = await page.evaluate(() => {
    const svg = document.querySelector('#se_canvas svg.feature-canvas');
    return {
      stockRects: svg.querySelectorAll('rect.fc-stock').length,
      pocketRects: svg.querySelectorAll('rect.fc-feature-pocket').length,
    };
  });
  expect(rendered.stockRects, 'the outer block is drawn (fc-stock)').toBe(1);
  expect(rendered.pocketRects, 'the legacy pocket renders as a derived cavity (fc-feature-pocket)').toBe(1);

  // GATE artifact — screenshot the redone modal for the human to eyeball
  await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/stock_modal_m1a.png' });

  // restore settings so other specs are unaffected
  await page.evaluate((snap) => { const KEY = 'ddcs_studio_settings'; if (snap != null) localStorage.setItem(KEY, snap); else localStorage.removeItem(KEY); }, shot);
});
