import { test, expect } from '@playwright/test';

/**
 * WORKPIECE PIVOT — M2: FEATURE drag-editing (origin OFFSET + size EXTENT) on the stock modal's top-view.
 *
 * A feature's `pos` is a DATUM-RELATIVE offset (measured from part-zero, how a CNC operator reads it) — so the same
 * cavity has different `pos` numbers under different datums but renders at the SAME place (datumXY + pos). The ORIGIN
 * handle sets the offset; the SIZE handle sets the extent. A LEGACY pocket (derived, not stored) MATERIALIZES into a
 * stored features[] entry on first drag. ASSERT-THE-VALUE + REAL-SYMPTOM.
 */
test.use({ viewport: { width: 1200, height: 900 } });

test('M2: pocket origin (datum-relative offset) + size (extent) drag → features[] updates, materializes, renders', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsOpenStock);

  // ── PURE — the offset is DATUM-RELATIVE, but the render position is datum-invariant (datumXY + pos) ──
  const pure = await page.evaluate(async () => {
    const { projectWorkpiece, workpieceBackdrop, datumXY } = await import('/engine/workpiece.js');
    const nnp = projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'pocket', datum: 'nnp' });
    const ccp = projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'pocket', datum: 'ccp' });
    return {
      nnpPos: nnp.features[0].pos, ccpPos: ccp.features[0].pos,
      nnpRect: workpieceBackdrop(nnp).items[0], ccpRect: workpieceBackdrop(ccp).items[0],
      dpCcp: datumXY(ccp.outer),
    };
  });
  // front-left datum → the block centre is (50,40) FROM part-zero; centre datum → the centre IS part-zero → (0,0)
  expect(pure.nnpPos, 'front-left datum: offset to the block centre').toEqual({ x: 50, y: 40 });
  expect(pure.ccpPos, 'centre datum: the centred cavity sits AT part-zero → zero offset').toEqual({ x: 0, y: 0 });
  // ...yet BOTH render the cavity at the SAME canvas rect (datumXY + pos) — datum-relative pos, datum-invariant render
  expect(pure.nnpRect).toEqual({ kind: 'rect', x: 20, y: 20, w: 60, h: 40, cls: 'fc-feature-pocket' });
  expect(pure.ccpRect).toEqual({ kind: 'rect', x: 20, y: 20, w: 60, h: 40, cls: 'fc-feature-pocket' });
  expect(pure.dpCcp, 'centre datum sits at the block centre').toEqual({ x: 50, y: 40 });

  // ── REAL-SYMPTOM — open a pocket; drag the ORIGIN off-centre → it MATERIALIZES + moves ──
  const snapshot = await page.evaluate(async () => {
    const SP = await import('/ui/settingsPanel.js');
    const snap = localStorage.getItem('ddcs_studio_settings');
    SP.applySettings({ stock: { x: 120, y: 90, z: 20, shape: 'pocket', show: true, datum: 'nnp', pin: 'origin', features: [] } });
    window.ddcsOpenStock();
    return snap;
  });
  const org = page.locator('#se_canvas svg .fc-handle[data-hid="feat0_org"]');
  await expect(org, 'the pocket has an ORIGIN handle').toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(300);

  const drag = await page.evaluate(() => {
    const before = (window.ddcsGetSettings().stock.features || []).length;
    const h = document.querySelector('#se_canvas svg .fc-handle[data-hid="feat0_org"]');
    const svg = h.closest('svg');
    const r = h.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // screen +x → world +x; screen +y → world −y. Move the origin toward +X / −Y.
    svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true, cancelable: true, pointerId: 1 }));
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + 30, clientY: cy + 20, bubbles: true, cancelable: true, pointerId: 1 }));
    svg.dispatchEvent(new PointerEvent('pointerup',   { clientX: cx + 30, clientY: cy + 20, bubbles: true, cancelable: true, pointerId: 1 }));
    const feats = window.ddcsGetSettings().stock.features;
    return { before, afterLen: feats.length, pos: feats[0] && feats[0].pos };
  });
  expect(drag.before, 'the legacy pocket is DERIVED (settings.stock.features empty) before editing').toBe(0);
  expect(drag.afterLen, 'the first drag MATERIALIZES it into a stored features[] entry').toBe(1);
  expect(drag.pos.x, 'the origin moved +X (its datum-relative offset grew from 60)').toBeGreaterThan(60);
  expect(drag.pos.y, 'the origin moved −Y (from 45)').toBeLessThan(45);

  await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/stock_modal_m2.png' });

  // ── the SIZE handle sets the EXTENT ──
  const sizeDrag = await page.evaluate(() => {
    const h = document.querySelector('#se_canvas svg .fc-handle[data-hid="feat0_size"]');
    const beforeX = window.ddcsGetSettings().stock.features[0].size.x;
    const svg = h.closest('svg');
    const r = h.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true, cancelable: true, pointerId: 1 }));
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + 25, clientY: cy - 25, bubbles: true, cancelable: true, pointerId: 1 }));
    svg.dispatchEvent(new PointerEvent('pointerup',   { clientX: cx + 25, clientY: cy - 25, bubbles: true, cancelable: true, pointerId: 1 }));
    return { beforeX, afterX: window.ddcsGetSettings().stock.features[0].size.x };
  });
  expect(sizeDrag.afterX, 'dragging the size handle outward grew the extent').toBeGreaterThan(sizeDrag.beforeX);

  // ── 3D coherence — the modal's 3D re-rendered the stock (migrated setStock reads features[]) ──
  const has3d = await page.evaluate(() => !!document.querySelector('#se_3d canvas'));
  expect(has3d, 'the 3D pane renders the stock with its cavity (setStock reads features[])').toBe(true);

  await page.evaluate((snap) => { const K = 'ddcs_studio_settings'; if (snap != null) localStorage.setItem(K, snap); else localStorage.removeItem(K); }, snapshot);
});
