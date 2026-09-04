import { test, expect } from '@playwright/test';

/**
 * MARKER PARITY (t301) — the ANTI-GREEN guard: assert the 3D-preview wall marker and the Layout wall marker are at the
 * SAME world spot (< 1mm) BOTH at rest AND after a real Start-drag (the two panels against EACH OTHER — a 3D-only drift
 * trips this even if the Layout is perfect), each HELD, and #23/#24 recompute = wall − Start. Real rendered positions.
 */
test.use({ viewport: { width: 1500, height: 1000 } });
const OUT = 'scratchpad/';

async function openCorner(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#userVizContainer_tree .fc-handle-sim', { timeout: 8000 });
  await page.waitForTimeout(500);
}

// the wall marker world in BOTH panels, read from the ACTUAL rendered geometry (not getPassStarts alone)
const worlds = (page) => page.evaluate(() => {
  const panel = window.ddcsStudio.wizardManager._activePanel; const viz = panel && panel.viz;
  // 3D: the CYAN (#22d3ee) wall marker sprite's rendered world (Start is amber #ffb300)
  let wall3d = null, start3d = null;
  (viz && viz.spindleMarkers || []).forEach((m) => {
    const g = m.children[0]; const hex = g && g.material && g.material.color && g.material.color.getHex();
    const p = m.position;
    if (hex === 0x22d3ee) wall3d = { x: p.x, y: p.y }; else if (hex === 0xffb300) start3d = { x: p.x, y: p.y };
  });
  // Layout: reposition_pos + __simstart0 SVG px → world via the fc-stock rect (world [0,w]×[0,h])
  const cont = document.getElementById('userVizContainer_tree'); const svg = cont.querySelector('svg');
  const rects = [...svg.querySelectorAll('rect')].map((r) => ({ r, b: r.getBoundingClientRect() }));
  const stock = rects.filter((o) => o.b.width > 40 && o.b.height > 40).sort((a, b) => b.b.width * b.b.height - a.b.width * a.b.height)[0];
  const sk = window.ddcsGetSettings().stock; const W = sk.x, H = sk.y;
  const toWorld = (el) => { if (!el || !stock) return null; const r = el.getBoundingClientRect(); const sx = r.x + r.width / 2, sy = r.y + r.height / 2; const b = stock.b; return { x: (sx - b.x) / b.width * W, y: H - (sy - b.y) / b.height * H }; };
  const wallLay = toWorld(cont.querySelector('[data-hid="reposition_pos"]'));
  const startLay = toWorld(cont.querySelector('[data-hid="__simstart0"]'));
  const ps = (panel.getPassStarts && panel.getPassStarts()) || [];
  const pe = (panel.getPassEnds && panel.getPassEnds()) || [];
  return { wall3d, start3d, wallLay, startLay, pe0: pe[0] ? { x: pe[0].x, y: pe[0].y } : null, passStarts: ps.map((s) => ({ x: s.x, y: s.y, pinned: !!s.pinned })) };
});
const paramVal = (page, p) => page.evaluate((p) => { const i = document.querySelector(`#wiz_user_form [data-param="${p}"]`); return i ? i.value : null; }, p);
const d = (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.y - b.y) : 999;

test('ANTI-GREEN: the wall marker is COINCIDENT in both panels at rest AND held after a Start-drag; #23/#24 recompute', async ({ page }) => {
  await openCorner(page);
  const before = await worlds(page);
  console.log('PARITY before: 3D wall=' + JSON.stringify(before.wall3d) + ' Layout wall=' + JSON.stringify(before.wallLay) + ' Δ=' + d(before.wall3d, before.wallLay).toFixed(2) + 'mm');
  await page.screenshot({ path: OUT + 'parity_before.png' });   // full wizard — 3D preview (top) + Layout (bottom), both panels

  // AT REST: coincident
  expect(d(before.wall3d, before.wallLay), 'AT REST: 3D wall == Layout wall (<1mm)').toBeLessThan(1);

  const cx0 = await paramVal(page, 'cross1_x'), cy0 = await paramVal(page, 'cross1_y');
  // real Start-drag
  const start = await page.$eval('#userVizContainer_tree [data-hid="__simstart0"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 70, start.y + 45, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(600);

  const after = await worlds(page);
  console.log('PARITY after : 3D wall=' + JSON.stringify(after.wall3d) + ' Layout wall=' + JSON.stringify(after.wallLay) + ' Δ=' + d(after.wall3d, after.wallLay).toFixed(2) + 'mm');
  const cx1 = await paramVal(page, 'cross1_x'), cy1 = await paramVal(page, 'cross1_y');
  await page.screenshot({ path: OUT + 'parity_after.png' });   // full wizard — both panels after the Start-drag

  // AFTER a Start-drag: (1) each wall HELD; (2) the two panels still COINCIDENT (the anti-green guard); (3) #23/#24 recompute
  expect(d(before.wallLay, after.wallLay), 'Layout wall HELD through the drag (<1mm)').toBeLessThan(1);
  expect(d(before.wall3d, after.wall3d), '3D wall HELD through the drag (<1mm) — the fix: it no longer rides the Start').toBeLessThan(1);
  expect(d(after.wall3d, after.wallLay), 'ANTI-GREEN: after the drag the 3D wall == the Layout wall (<1mm) — a 3D-only drift trips THIS even if the Layout is green').toBeLessThan(1);
  // the Start itself DID move (in both panels)
  expect(d(before.startLay, after.startLay), 'the Start moved with the drag').toBeGreaterThan(15);
  // #23/#24 recompute (the emit changes) and equal wall − Start (assert the VALUE, not just "changed")
  const n = (v) => (v == null || v === '') ? null : parseFloat(v);
  expect(Number.isFinite(n(cx1)) && Number.isFinite(n(cy1)), `#23/#24 became finite (${cx0}→${cx1}, ${cy0}→${cy1})`).toBe(true);
  expect(n(cx1) !== n(cx0) || n(cy1) !== n(cy0), '#23/#24 recomputed').toBe(true);
  // value: #23/#24 is the G91 increment FROM the anchor pass's runtime END (passEnds[0], which followed the dragged Start)
  // TO the held wall world — so anchor + #23/#24 = the held wall (the round-trip proves the emit encodes the held wall).
  const wantX = after.wallLay.x - after.pe0.x, wantY = after.wallLay.y - after.pe0.y;
  expect(Math.abs(n(cx1) - wantX), `#23 = wall − anchor-end value (got ${n(cx1)}, want ~${wantX.toFixed(1)})`).toBeLessThan(3);
  expect(Math.abs(n(cy1) - wantY), `#24 = wall − anchor-end value (got ${n(cy1)}, want ~${wantY.toFixed(1)})`).toBeLessThan(3);
  // round-trip: applying the recomputed increment from the (Start-shifted) anchor lands back on the HELD wall
  expect(Math.hypot((after.pe0.x + n(cx1)) - after.wallLay.x, (after.pe0.y + n(cy1)) - after.wallLay.y), 'anchor-end + #23/#24 = the held wall world').toBeLessThan(2);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  console.log('SHOTS ' + OUT + 'parity_before.png + parity_after.png (both panels each)');
});
