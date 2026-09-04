import { test, expect } from '@playwright/test';

/**
 * 2D-ANIMATION-ON-LAYOUT (t309) — a path-only toolpath2d <canvas> UNDER the Layout SVG shows the traced toolpath + the
 * red probe head, driven by the SAME engine as the 3D. VERIFY: INC-1 the overlay is PIXEL-EXACT under the handles (its
 * view maps the stock corners onto the SVG stock rect, at rest AND after a zoom — the load-bearing alignment proof);
 * INC-2 clicking Run animates the red head on the overlay; INC-3 the handles still drag (the overlay is pointer-events:none).
 */
test.use({ viewport: { width: 1400, height: 1000 } });
const OUT = 'scratchpad/';

// `beforeOpen` (optional) runs AFTER navigation but BEFORE the wizard opens — settings must be set here, not
// before calling openCorner: ddcsGetSettings() returns a plain in-memory object (there is no ddcsSetSettings;
// a mutation before this function's own page.goto is wiped by that goto, a real trap this file's own t1686
// addition first fell into — caught only because the non-vacuity swap-in-pre-fix-code check still passed).
async function openCorner(page, beforeOpen) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  if (typeof beforeOpen === 'function') await beforeOpen();
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#userVizContainer_tree .fc-handle-sim', { timeout: 8000 });
  await page.waitForSelector('#userVizContainer_tree .fc-anim-overlay', { timeout: 6000 });
  await page.waitForTimeout(500);
}

// Map the stock world corners through the OVERLAY's published view, and read the SVG stock rect corners — compare in SCREEN px.
const alignment = (page) => page.evaluate(() => {
  const cont = document.getElementById('userVizContainer_tree');
  const canvas = cont.querySelector('.fc-anim-overlay');
  const svg = cont.querySelector('svg');
  const v = canvas.__t2view;                                   // { ox, oy, scale } — set by setViewTransform in overlay paint
  const cr = canvas.getBoundingClientRect();
  const sk = window.ddcsGetSettings().stock; const W = sk.x, H = sk.y;
  // overlay world → screen: canvasRect + (ox + x*scale, oy - y*scale)
  const ovl = (x, y) => ({ x: cr.x + v.ox + x * v.scale, y: cr.y + v.oy - y * v.scale });
  // SVG stock rect (largest rect) screen corners: TL = world(0,H), BR = world(W,0)
  const rects = [...svg.querySelectorAll('rect')].map((r) => r.getBoundingClientRect()).filter((b) => b.width > 40 && b.height > 40).sort((a, b) => b.width * b.height - a.width * a.height);
  const st = rects[0];
  return {
    hasView: !!v, scale: v && v.scale,
    tl: { ovl: ovl(0, H), svg: { x: st.x, y: st.y } },
    br: { ovl: ovl(W, 0), svg: { x: st.x + st.width, y: st.y + st.height } },
  };
});
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('INC-1: the overlay is PIXEL-EXACT under the SVG (stock corners coincide) at rest AND after a zoom', async ({ page }) => {
  await openCorner(page);
  const a0 = await alignment(page);
  expect(a0.hasView, 'the overlay published its view (__t2view)').toBe(true);
  expect(d(a0.tl.ovl, a0.tl.svg), `AT REST: overlay top-left maps onto the SVG stock TL (ovl ${JSON.stringify(a0.tl.ovl)} vs svg ${JSON.stringify(a0.tl.svg)})`).toBeLessThan(2);
  expect(d(a0.br.ovl, a0.br.svg), 'AT REST: overlay bottom-right maps onto the SVG stock BR').toBeLessThan(2);

  // zoom the SVG (wheel) → the overlay must re-pin via onTransform and stay aligned
  const svgBox = await page.$eval('#userVizContainer_tree svg', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(svgBox.x, svgBox.y);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(300);
  const a1 = await alignment(page);
  expect(a1.scale, 'the zoom changed the scale').not.toBeCloseTo(a0.scale, 3);
  expect(d(a1.tl.ovl, a1.tl.svg), 'AFTER ZOOM: overlay TL still maps onto the SVG stock TL (re-pinned via onTransform)').toBeLessThan(2);
  expect(d(a1.br.ovl, a1.br.svg), 'AFTER ZOOM: overlay BR still maps onto the SVG stock BR').toBeLessThan(2);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

// t1686 — the live bug this INC-1 alignment proof never actually exercised: a WCS pin active. getTransform()
// (featureCanvas.js) returned the bare pan/zoom transform without folding in spec.placement (the pin shift,
// t1672), so the overlay pinned itself to the OLD, unshifted frame while the SVG stock/handles (which read
// spec.placement directly via _disp) moved to the pin — the user's reported split, reproduced here with the
// SAME alignment() helper INC-1 already trusts, just with a pin set before the wizard opens.
test('INC-4 (t1686): PIXEL-EXACT holds with a WCS pin active too — the overlay reads the SAME shifted frame as the SVG', async ({ page }) => {
  await openCorner(page, () => page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.stock = Object.assign(s.stock || {}, { x: 200, y: 150, z: 20, show: true, datum: 'nnp', pin: 'G55' });
    s.machine = Object.assign(s.machine || {}, { x: 800, y: 500, z: 120, show: true });
    s.machine.wcs = s.machine.wcs || {}; s.machine.wcs.active = 1;
    s.machine.wcs.table = [{ x: 0, y: 0, z: 0 }, { x: 300, y: 200, z: -10 }];
  }));
  const a0 = await alignment(page);
  expect(a0.hasView, 'the overlay published its view (__t2view)').toBe(true);
  expect(d(a0.tl.ovl, a0.tl.svg), `PINNED: overlay top-left still maps onto the SVG stock TL (ovl ${JSON.stringify(a0.tl.ovl)} vs svg ${JSON.stringify(a0.tl.svg)}) — the reported split, closed`).toBeLessThan(2);
  expect(d(a0.br.ovl, a0.br.svg), 'PINNED: overlay bottom-right still maps onto the SVG stock BR').toBeLessThan(2);
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    delete s.stock.pin; s.machine = Object.assign(s.machine || {}, { show: false });
    if (window.ddcsSetSettings) window.ddcsSetSettings(s);
    localStorage.removeItem('ddcs_user_ops');
  });
});

test('INC-2: the shared engine feeds MOVING live positions to the overlay head (path drawn + animates)', async ({ page }) => {
  await openCorner(page);
  // the traced toolpath is drawn statically in the overlay regardless of play (the path-under-handles value)
  const nSegs = await page.evaluate(() => { const p = document.querySelector('.wiz-viz3d').__panel; return (p.getSegments() || []).length; });
  expect(nSegs, 'the overlay has a traced toolpath to draw').toBeGreaterThan(0);

  // the ANIMATION DRIVE: instrument onToolPos, run, and confirm the engine delivers MOVING live positions to the Layout
  await page.evaluate(() => { const p = document.querySelector('.wiz-viz3d').__panel; window.__tp = []; p.onToolPos((pos) => window.__tp.push(pos ? { x: pos.x, y: pos.y } : null)); });
  const run = await page.$('.wiz-viz3d .pp-run') || await page.$('.pp-run');
  expect(run, 'the Run button exists').toBeTruthy();
  await run.click();
  await page.waitForTimeout(1200);   // the corner live-sim is brief in headless (stops early, same as the 3D) — collect what it delivers
  const tp = await page.evaluate(() => window.__tp);
  const live = tp.filter(Boolean);
  const distinct = live.filter((p, i) => i === 0 || Math.hypot(p.x - live[i - 1].x, p.y - live[i - 1].y) > 0.01);
  expect(live.length, 'the engine fed live positions to the overlay (onToolPos, in 3D-top mode)').toBeGreaterThan(0);
  expect(distinct.length, `the fed position MOVED (${distinct.length} distinct) — the head animates as the engine advances`).toBeGreaterThanOrEqual(2);

  // stage a clear mid-path frame for the human (the live sim is too fast/brief to race): drive the head onto the path,
  // then confirm the overlay drew a LIVE red head there — this is the same setToolPosition path the engine drives.
  const shot = await page.evaluate(() => {
    const p = document.querySelector('.wiz-viz3d').__panel; const ov = document.getElementById('userVizContainer_tree').__animOverlay;
    const segs = p.getSegments() || []; if (!segs.length || !ov) return null;
    const len = (s) => Math.hypot((s.x2 || 0) - (s.x1 || 0), (s.y2 || 0) - (s.y1 || 0));
    let idx = 0; for (let i = 1; i < segs.length; i++) if (len(segs[i]) > len(segs[idx])) idx = i;   // the LONGEST segment (a visible arm, clear of the markers)
    const s = segs[idx];
    ov.tp.seek(idx); ov.tp.setToolPosition({ x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2, pass: s.pass });   // its MIDPOINT
    return ov.canvas.__t2head ? { ...ov.canvas.__t2head } : null;
  });
  expect(shot && shot.live, 'the overlay drew a LIVE red head on the path').toBe(true);
  await page.screenshot({ path: OUT + 'anim_overlay.png' });   // the traced path under the handles + the red probe head on it
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('INC-3: the handles are still drag-writable through the pointer-events:none overlay', async ({ page }) => {
  await openCorner(page);
  const cx0 = await page.evaluate(() => { const i = document.querySelector('#wiz_user_form [data-param="cross1_x"]'); return i ? i.value : null; });
  const start = await page.$eval('#userVizContainer_tree [data-hid="__simstart0"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 60, start.y + 40, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(400);
  const cx1 = await page.evaluate(() => { const i = document.querySelector('#wiz_user_form [data-param="cross1_x"]'); return i ? i.value : null; });
  expect(cx1 !== cx0 && cx1 != null && cx1 !== '', `the Start drag reached the handle + recomputed #23 (${cx0}→${cx1}) — the overlay did not block it`).toBe(true);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
