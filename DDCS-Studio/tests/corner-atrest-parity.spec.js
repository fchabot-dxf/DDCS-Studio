import { test, expect } from '@playwright/test';

/**
 * AT-REST MARKER PARITY (t303) — the human gate caught: the 3D wall marker and the Layout wall marker do NOT coincide
 * AT REST in some configs (they only snap together after a Start-drag pins them). The prior anti-green guard tested ONE
 * at-rest-coincident config (FL/YX/Zoff, a single cyan marker) so it missed it. This UPGRADES the guard: assert
 * |3D − Layout| < 1mm AT REST across ALL 16 configs (4 corners × 2 probeSeq × 2 probeZ), pairing each reposition handle
 * to its PASS-INDEXED 3D marker (wall-2 = the last pass; wall-1 = the second-to-last), and DUMPS the internals of any
 * diverging config so the root is confirmed by real rendered geometry, not a numeric proxy.
 */
test.use({ viewport: { width: 1400, height: 1000 } });
const OUT = 'scratchpad/';

async function openCorner(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#userVizContainer .fc-handle-sim', { timeout: 8000 });
  await page.waitForTimeout(400);
}
async function setSel(page, param, value) {
  await page.evaluate(({ param, value }) => { const s = document.querySelector(`#wiz_user_form [data-param="${param}"]`); if (s && s.value !== value) { s.value = value; s.dispatchEvent(new Event('change', { bubbles: true })); } }, { param, value });
  await page.waitForTimeout(300);
}
async function setProbeZ(page, on) {
  await page.evaluate((on) => {
    const span = [...document.querySelectorAll('#wiz_user_form *')].find((e) => e.tagName === 'SPAN' && /Probe Z First/i.test(e.textContent || ''));
    const cb = span && span.parentElement && span.parentElement.querySelector('input[type="checkbox"]');
    if (cb && !!cb.checked !== on) { cb.checked = on; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  }, on);
  if (on) await page.waitForFunction(() => document.querySelectorAll('#userVizContainer .fc-handle-move').length >= 2, { timeout: 6000 });
  await page.waitForTimeout(300);
}

// At REST: the 3D marker worlds (by pass), the Layout reposition-handle worlds, and the panel internals — all real.
const snapshot = (page) => page.evaluate(() => {
  const panel = window.ddcsStudio.wizardManager._activePanel; const viz = panel && panel.viz;
  const markers = (viz && viz.spindleMarkers || []).map((m, p) => {
    const g = m.children[0]; const hex = g && g.material && g.material.color && g.material.color.getHex();
    return { p, hex, x: +m.position.x, y: +m.position.y };
  });
  // Layout px → world via the largest fc-stock rect (world [0,w]×[0,h], y flipped)
  const cont = document.getElementById('userVizContainer'); const svg = cont.querySelector('svg');
  const rects = [...svg.querySelectorAll('rect')].map((r) => ({ r, b: r.getBoundingClientRect() }));
  const stock = rects.filter((o) => o.b.width > 40 && o.b.height > 40).sort((a, b) => b.b.width * b.b.height - a.b.width * a.b.height)[0];
  const sk = window.ddcsGetSettings().stock; const W = sk.x, H = sk.y;
  const toWorld = (el) => { if (!el || !stock) return null; const r = el.getBoundingClientRect(); const sx = r.x + r.width / 2, sy = r.y + r.height / 2; const b = stock.b; return { x: (sx - b.x) / b.width * W, y: H - (sy - b.y) / b.height * H }; };
  const layWall2 = toWorld(cont.querySelector('[data-hid="reposition_pos"]'));   // wall-2 = the last pass
  const layWall1 = toWorld(cont.querySelector('[data-hid="start_pos"]'));         // wall-1 (probeZ on only)
  const round = (a) => Array.isArray(a) ? a.map((o) => o && { x: +(+o.x).toFixed(2), y: +(+o.y).toFixed(2), pinned: !!o.pinned, anchorsAtPrev: !!o.anchorsAtPrev }) : a;
  return {
    markers, layWall2, layWall1,
    starts: round(viz && viz.starts), panelStarts: round(panel.getPassStarts && panel.getPassStarts()),
    vizPassEnds: round(viz && viz._passEnds), panelPassEnds: round(panel.getPassEnds && panel.getPassEnds()),
  };
});
const d = (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.y - b.y) : 999;

test('ANTI-GREEN v2: the wall markers are COINCIDENT (3D == Layout) AT REST across ALL 16 configs', async ({ page }) => {
  test.setTimeout(240000);
  const fails = [], diag = [];
  for (const corner of ['FL', 'FR', 'BL', 'BR']) for (const seq of ['YX', 'XY']) for (const z of [false, true]) {
    const cfg = `${corner}/${seq}/Z${z ? 'on' : 'off'}`;
    await openCorner(page);
    await setSel(page, 'corner', corner);
    await setSel(page, 'probeSeq', seq);
    if (z) await setProbeZ(page, true);
    const s = await snapshot(page);
    const n = s.markers.length;
    // wall-2 = the last pass marker; wall-1 = the second-to-last (probeZ on adds the zsurf pass at index 0)
    const mk2 = s.markers[n - 1], mk1 = z ? s.markers[n - 2] : null;
    const d2 = d(mk2, s.layWall2), d1 = z ? d(mk1, s.layWall1) : 0;
    const worst = Math.max(d2, d1);
    console.log(`REST ${cfg}: wall2 3D=(${mk2 ? mk2.x.toFixed(1) + ',' + mk2.y.toFixed(1) : '—'}) Lay=(${s.layWall2 ? s.layWall2.x.toFixed(1) + ',' + s.layWall2.y.toFixed(1) : '—'}) Δ=${d2.toFixed(2)}` + (z ? ` | wall1 Δ=${d1.toFixed(2)}` : ''));
    if (d2 >= 1) fails.push(`${cfg}: wall-2 3D vs Layout Δ=${d2.toFixed(2)}mm (should be <1)`);
    if (z && d1 >= 1) fails.push(`${cfg}: wall-1 3D vs Layout Δ=${d1.toFixed(2)}mm (should be <1)`);
    if (worst >= 1) diag.push({ cfg, d2, d1, ...s });
    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  }
  if (diag.length) {
    const first = diag[0];
    console.log('\n=== FIRST DIVERGING CONFIG: ' + first.cfg + ' ===');
    console.log('markers(by pass): ' + JSON.stringify(first.markers.map((m) => ({ p: m.p, x: +m.x.toFixed(2), y: +m.y.toFixed(2), hex: '0x' + (m.hex || 0).toString(16) }))));
    console.log('layWall2: ' + JSON.stringify(first.layWall2) + '  layWall1: ' + JSON.stringify(first.layWall1));
    console.log('viz.starts:      ' + JSON.stringify(first.starts));
    console.log('panelStarts:     ' + JSON.stringify(first.panelStarts));
    console.log('viz._passEnds:   ' + JSON.stringify(first.vizPassEnds));
    console.log('panelPassEnds:   ' + JSON.stringify(first.panelPassEnds));
  }
  expect(fails, `all 16 configs at-rest coincident (3D == Layout <1mm):\n${fails.join('\n')}`).toEqual([]);
});

// STRESS the edge cases the 16-sweep could mask: a settling FLASH (measure at 0/50/200/500ms), a LITERAL reposition
// value already set, a non-default stock, and the panelStarts-length fallback (Layout -> opSimStarts, which could diverge).
const stressSnap = (page) => page.evaluate(() => {
  const panel = window.ddcsStudio.wizardManager._activePanel; const viz = panel && panel.viz;
  const markers = (viz && viz.spindleMarkers || []).map((m) => ({ x: +m.position.x, y: +m.position.y }));
  const cont = document.getElementById('userVizContainer'); const svg = cont.querySelector('svg');
  const rects = [...svg.querySelectorAll('rect')].map((r) => ({ r, b: r.getBoundingClientRect() }));
  const stock = rects.filter((o) => o.b.width > 40 && o.b.height > 40).sort((a, b) => b.b.width * b.b.height - a.b.width * a.b.height)[0];
  const sk = window.ddcsGetSettings().stock; const W = sk.x, H = sk.y;
  const toWorld = (el) => { if (!el || !stock) return null; const r = el.getBoundingClientRect(); const sx = r.x + r.width / 2, sy = r.y + r.height / 2; const b = stock.b; return { x: (sx - b.x) / b.width * W, y: H - (sy - b.y) / b.height * H }; };
  const lay = toWorld(cont.querySelector('[data-hid="reposition_pos"]'));
  const ps = (panel.getPassStarts && panel.getPassStarts()) || [];
  return { mk: markers[markers.length - 1], lay, nMarkers: markers.length, nPanelStarts: ps.length };
});
const dd = (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.y - b.y) : 999;

test('STRESS: no settling flash, literal value, non-default stock, panelStarts covers every pass', async ({ page }) => {
  test.setTimeout(120000);
  const fails = [];
  // (A) settling flash — measure the FL/XY/Zon config at increasing delays
  await openCorner(page);
  await setSel(page, 'corner', 'BR'); await setSel(page, 'probeSeq', 'XY'); await setProbeZ(page, true);
  await page.screenshot({ path: OUT + 'atrest_BR_XY_Zon.png' });   // a REST shot of the most complex (3-marker) config for the human to point at what they mean by "not coincident"
  for (const ms of [0, 50, 200, 500]) {
    await page.waitForTimeout(ms === 0 ? 0 : (ms - (ms === 50 ? 0 : 0)));
    const s = await stressSnap(page);
    const dv = dd(s.mk, s.lay);
    console.log(`FLASH @~${ms}ms: 3D=(${s.mk ? s.mk.x.toFixed(1) + ',' + s.mk.y.toFixed(1) : '—'}) Lay=(${s.lay ? s.lay.x.toFixed(1) + ',' + s.lay.y.toFixed(1) : '—'}) Δ=${dv.toFixed(2)} nMk=${s.nMarkers} nPS=${s.nPanelStarts}`);
    if (dv >= 1) fails.push(`flash@${ms}ms Δ=${dv.toFixed(2)}`);
    if (s.nPanelStarts < s.nMarkers) fails.push(`panelStarts(${s.nPanelStarts}) < markers(${s.nMarkers}) → Layout FALLBACK path`);
  }
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // (B) a LITERAL reposition value already set (not the formula default)
  await openCorner(page);
  await page.evaluate(() => { const set = (p, v) => { const i = document.querySelector(`#wiz_user_form [data-param="${p}"]`); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } }; set('cross1_x', '25'); set('cross1_y', '18'); });
  await page.waitForTimeout(500);
  const sB = await stressSnap(page);
  const dB = dd(sB.mk, sB.lay);
  console.log(`LITERAL cross1=25,18: 3D=(${sB.mk ? sB.mk.x.toFixed(1) + ',' + sB.mk.y.toFixed(1) : '—'}) Lay=(${sB.lay ? sB.lay.x.toFixed(1) + ',' + sB.lay.y.toFixed(1) : '—'}) Δ=${dB.toFixed(2)}`);
  if (dB >= 1) fails.push(`literal-value Δ=${dB.toFixed(2)}`);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // (C) non-default stock size (changes the datum + marker worlds; both panels should still coincide)
  await openCorner(page);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { ...s.stock, x: 320, y: 240 }; if (window.ddcsSetSettings) window.ddcsSetSettings(s); });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForTimeout(600);
  const sC = await stressSnap(page);
  const dC = dd(sC.mk, sC.lay);
  console.log(`STOCK 320x240: 3D=(${sC.mk ? sC.mk.x.toFixed(1) + ',' + sC.mk.y.toFixed(1) : '—'}) Lay=(${sC.lay ? sC.lay.x.toFixed(1) + ',' + sC.lay.y.toFixed(1) : '—'}) Δ=${dC.toFixed(2)}`);
  if (dC >= 1) fails.push(`non-default-stock Δ=${dC.toFixed(2)}`);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(fails, `no at-rest divergence in any stress case:\n${fails.join('\n')}`).toEqual([]);
});
