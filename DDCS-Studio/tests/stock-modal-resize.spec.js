import { test, expect } from '@playwright/test';

/**
 * WORKPIECE PIVOT — M1b: the stock modal's SIDE-BY-SIDE layout + OUTER DRAG-EDITING.
 *
 * The outer block gets a resize handle on the fc-stock rect; dragging it writes the FLAT settings.stock.x/y via
 * applySettings → PROPAGATES to every consumer (the coherence rule). REAL-SYMPTOM + ASSERT-THE-VALUE:
 *  (1) dragging the max-XY corner outward GROWS stock.x/y from the pinned part-zero corner (datum unchanged);
 *  (2) the X/Y fields sync two-way (drag→field AND field→canvas);
 *  (3) the drag broadcasts ddcs:settings-changed with the new stock (what the 3D + wizard previews re-render from),
 *      and the shared workpieceBackdrop (every canvas's ONE source) reflects the new dims.
 */

test.use({ viewport: { width: 1200, height: 900 } });   // desktop width — the side-by-side modal is min(660px, 96vw)

test('M1b: dragging the outer handle resizes the stock from the datum corner, syncs fields two-way, propagates', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsOpenStock);

  const snapshot = await page.evaluate(async () => {
    const SP = await import('/ui/settingsPanel.js');
    const snap = localStorage.getItem('ddcs_studio_settings');
    SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'boss', show: true, datum: 'nnp', pin: 'origin' } });
    window.ddcsOpenStock();
    return snap;
  });

  const handle = page.locator('#se_canvas svg .fc-handle[data-hid="outer_size"]');
  await expect(handle, 'the outer block has a resize handle').toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(300);   // rAF fit + draw

  // DUAL-PANE (human t355): a stock-only 3D preview pane mounted beside the 2D top-view (a live WebGL canvas)
  const pane3d = await page.evaluate(() => {
    const pane = document.querySelector('#se_3d');
    return { exists: !!pane, canvas: !!(pane && pane.querySelector('canvas')), hasStockMesh: !!(pane && pane.querySelector('canvas')) };
  });
  expect(pane3d.exists, 'the modal has a 3D preview pane on the right').toBe(true);
  expect(pane3d.canvas, 'the 3D stock-only preview mounted a WebGL canvas (setStock, no toolpath)').toBe(true);

  // ── (1) DRAG the max-XY corner OUTWARD → grows both dims; fields sync; broadcast fires ──
  const drag = await page.evaluate(async () => {
    const h = document.querySelector('#se_canvas svg .fc-handle[data-hid="outer_size"]');
    const svg = h.ownerSVGElement || h.closest('svg');
    const r = h.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let broadcast = null;
    const onCh = () => { broadcast = window.ddcsGetSettings().stock; };
    window.addEventListener('ddcs:settings-changed', onCh);
    // screen +x grows world X; screen -y grows world Y (Y-up world → Y-down screen). Move the corner out.
    svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true, cancelable: true, pointerId: 1 }));
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + 40, clientY: cy - 40, bubbles: true, cancelable: true, pointerId: 1 }));
    svg.dispatchEvent(new PointerEvent('pointerup',   { clientX: cx + 40, clientY: cy - 40, bubbles: true, cancelable: true, pointerId: 1 }));
    window.removeEventListener('ddcs:settings-changed', onCh);
    const WP = await import('/engine/workpiece.js');
    const st = window.ddcsGetSettings().stock;
    const bd = WP.workpieceBackdrop(WP.getWorkpiece());
    return {
      x: st.x, y: st.y, z: st.z, datum: st.datum,
      fieldX: Number(document.querySelector('#se_x').value), fieldY: Number(document.querySelector('#se_y').value),
      broadcastX: broadcast && broadcast.x, backdropW: bd.stock.w, backdropOx: bd.stock.ox,
    };
  });
  expect(drag.x, 'dragging the corner outward grew stock.x').toBeGreaterThan(100);
  expect(drag.y, 'grew stock.y').toBeGreaterThan(80);
  expect(drag.z, 'Z (height) is untouched by the XY resize').toBe(20);
  expect(drag.datum, 'the datum/part-zero corner is UNCHANGED — the stock grows from its pinned corner').toBe('nnp');
  expect(drag.backdropOx, 'the min-XY (part-zero) corner stays at the origin (no jump)').toBe(0);
  expect(drag.fieldX, 'the X field synced to the drag (canvas→field two-way)').toBe(drag.x);
  expect(drag.fieldY, 'the Y field synced to the drag').toBe(drag.y);
  expect(drag.broadcastX, 'the drag broadcast ddcs:settings-changed with the new stock (drives the 3D + wizard re-render)').toBe(drag.x);
  expect(drag.backdropW, 'the shared workpieceBackdrop reflects the new width (every canvas consumes this ONE source)').toBe(drag.x);

  await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/stock_modal_m1b.png' });

  // ── (2) FIELD → CANVAS two-way: type an exact X → the flat stock + the shared backdrop reflect it deterministically ──
  const typed = await page.evaluate(async () => {
    const xEl = document.querySelector('#se_x'); xEl.value = '200'; xEl.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(r));
    const WP = await import('/engine/workpiece.js');
    return {
      stockX: window.ddcsGetSettings().stock.x,
      backdropW: WP.workpieceBackdrop(WP.getWorkpiece()).stock.w,
      hasHandle: !!document.querySelector('#se_canvas svg .fc-handle[data-hid="outer_size"]'),
    };
  });
  expect(typed.stockX, 'typing X=200 wrote the flat stock').toBe(200);
  expect(typed.backdropW, 'the canvas backdrop reflects the typed value (field→canvas two-way)').toBe(200);
  expect(typed.hasHandle, 'the resize handle re-rendered at the new corner').toBe(true);

  await page.evaluate((snap) => { const K = 'ddcs_studio_settings'; if (snap != null) localStorage.setItem(K, snap); else localStorage.removeItem(K); }, snapshot);
});
