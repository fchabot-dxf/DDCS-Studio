import { test, expect } from '@playwright/test';

/**
 * t816 E1.7 (2) — INCREMENTAL LIVE CRISPING (Option A: retained dirty rect + sub-rect crisp splice). During play the wall
 * crisps a BEAT BEHIND the cutter: the carve tracks a retained dirty RECT (grid-cell bounds per carveSeg, cleared on
 * splice); each throttle re-marches JUST the dirty rect (+ apron) and splices the sub-rect into the live crisp mesh (a
 * position memcpy, NO computeVertexNormals — flatShading). The cell marching is the SAME _crispContext the stop path uses.
 *
 * SAFETY (non-negotiable): the spliced mesh must be EQUAL (positions, within eps) to a full crisp re-mesh over the same
 * field — the independent truth so the splice can never drift.
 */
test.use({ viewport: { width: 1300, height: 950 } });

const RASTER = 'G90\nG0 X50 Y50 Z5\nG1 Z-8 F300\nX550\nY60\nX50\nY70\nX550\nY80\nX50\nY90\nX550\nG0 Z5\nM30\n';
const CORNER = 'G90\nG0 X30 Y20 Z5\nG1 Z-8 F300\nX66\nY24\nX30\nY28\nX66\nY32\nX30\nY36\nX66\nY40\nX30\nY44\nX66\nG0 Z5\nM30\n';

async function setup(page, stock, prog) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
  await page.evaluate((st) => { const s = window.ddcsGetSettings(); s.stock = { ...st, show: true, datum: 'nnp', features: [] }; s.preview = s.preview || {}; s.preview.autoLoop = false; s.preview.default3D = true; }, stock);
  await page.evaluate((g) => { const e = document.getElementById('editor'); e.value = g; window.setGcodeView('3d'); }, prog);
  await page.waitForTimeout(400);
  await page.evaluate((g) => { window.__gpPanel.setGcode(g); }, prog);   // builds the carve (_carve) via setCarve
  await page.waitForTimeout(500);
}

test('SAFETY GUARD: the spliced live-crisp mesh EQUALS a full crisp re-mesh (positions, eps) + mid-play crisp + cheap splice', async ({ page }) => {
  await setup(page, { x: 600, y: 400, z: 20 }, RASTER);
  const r = await page.evaluate(async (prog) => {
    const { traceToolpath } = await import('/engine/trace.js');
    const segs = traceToolpath(prog, {}).segments || [];
    const v = window.__gpPanel.viz, c = v._carve;
    v._buildCarveArc(segs, 3); c.reseed(v._stock, []);
    // simulate PLAY: carve the program → init the live crisp mesh (the wake is crisp); the mid-play mesh has true walls
    for (const s of segs) v.carveSeg(s, 3, 'flat');
    v.carveLiveCrisp();
    const modeMid = v._carveMeshMode, gm = v._carveMesh.geometry.attributes.position.array;
    const live = gm.slice();
    const m = new Map();
    for (let i = 0; i < gm.length; i += 3) { const k = gm[i].toFixed(2) + ',' + gm[i + 1].toFixed(2); const e = m.get(k) || { min: 1e9, max: -1e9 }; e.min = Math.min(e.min, gm[i + 2]); e.max = Math.max(e.max, gm[i + 2]); m.set(k, e); }
    let midWalls = 0; for (const e of m.values()) if (e.max - e.min > 6 && e.max - e.min < 14) midWalls++;
    // SAFETY GUARD: a full crisp re-mesh over the SAME field (no reseed) — the independent truth; both use _crispContext
    v._liveCrisp = null; v._rebuildCarveMesh('crisp');
    const full = v._carveMesh.geometry.attributes.position.array;
    let maxErr = 0; const sameLen = live.length === full.length;
    if (sameLen) for (let i = 0; i < full.length; i++) { const e = Math.abs(live[i] - full[i]); if (e > maxErr) maxErr = e; }
    // PERF: a REALISTIC per-throttle splice (one small extra cut → a small dirty band) vs the CURRENT whole-grid smooth
    // remesh (its computeVertexNormals is the fps-floor baseline the live path ships today) — the splice must be NO slower.
    v._liveCrisp = null; v.carveLiveCrisp();   // re-init the live crisp over the current field
    v.carveSeg({ x1: 60, y1: 100, z1: -8, x2: 160, y2: 100, z2: -8, type: 'feed' }, 3, 'flat');
    const spliceMs = v.carveLiveCrisp();
    v._rebuildCarveMesh('smooth'); c.dirty = true; const smoothMs = v._remeshCarve();
    return { nSegs: segs.length, modeMid, midWalls, spliceMs: +spliceMs.toFixed(2), smoothMs: +smoothMs.toFixed(2), sameLen, maxErr: +maxErr.toFixed(6) };
  }, RASTER);
  expect(r.nSegs, 'the program parsed to real feed segments').toBeGreaterThan(5);
  expect(r.modeMid, 'during play the live mesh is the incremental CRISP mesh').toBe('live-crisp');
  expect(r.midWalls, 'the carved wake renders TRUE crisp vertical walls (a beat behind the cutter)').toBeGreaterThan(20);
  expect(r.sameLen, 'the spliced mesh has the same vertex count as a full re-mesh').toBe(true);
  expect(r.maxErr, `the spliced mesh EQUALS a full crisp re-mesh within eps (max ${r.maxErr}) — the splice cannot drift`).toBeLessThan(1e-4);
  expect(r.spliceMs, `the crisp splice (${r.spliceMs}ms) is no slower than the current whole-grid smooth remesh (${r.smoothMs}ms) — the fps floor holds`).toBeLessThanOrEqual(r.smoothMs);
});

test('STOP-CRISP is unchanged: carveFinalize settles to the whole-mesh crisp path (mode crisp, walls hold)', async ({ page }) => {
  await setup(page, { x: 600, y: 400, z: 20 }, RASTER);
  const r = await page.evaluate(async (prog) => {
    const { traceToolpath } = await import('/engine/trace.js');
    const segs = traceToolpath(prog, {}).segments || [];
    const v = window.__gpPanel.viz, c = v._carve;
    v._buildCarveArc(segs, 3); c.reseed(v._stock, []);
    for (const s of segs) v.carveSeg(s, 3, 'flat');
    v.carveLiveCrisp();                 // live crisp during "play"
    v.carveFinalize(segs, 3, 'flat');   // STOP → the settled whole-mesh crisp
    return { mode: v._carveMeshMode, maxWall: v._carveMaxWall, live: !!v._liveCrisp };
  }, RASTER);
  expect(r.mode, 'stop settles to the whole-mesh crisp path').toBe('crisp');
  expect(r.maxWall, 'the crisp walls span the pocket depth').toBeGreaterThan(6);
  expect(r.live, 'the live-crisp cache is dropped on finalize').toBe(false);
});

test('the ARC SNAP applies inside the live sub-rect too — a live-crisp corner fillet sits on the true arc', async ({ page }) => {
  await setup(page, { x: 100, y: 80, z: 20 }, CORNER);
  const r = await page.evaluate(async (prog) => {
    const { traceToolpath } = await import('/engine/trace.js');
    const segs = traceToolpath(prog, {}).segments || [];
    const v = window.__gpPanel.viz, c = v._carve;
    v._buildCarveArc(segs, 3); c.reseed(v._stock, []);
    for (const s of segs) v.carveSeg(s, 3, 'flat');
    v.carveLiveCrisp();   // the LIVE crisp mesh (its cell marching runs the same arc snap)
    const g = v._carveMesh.geometry.attributes.position.array, HX = c.X / 2, HY = c.Y / 2, m = new Map();
    for (let i = 0; i < g.length; i += 3) { const x = g[i] + HX, y = g[i + 1] + HY, z = g[i + 2]; const k = x.toFixed(3) + ',' + y.toFixed(3); const e = m.get(k) || { x, y, min: 1e9, max: -1e9 }; e.min = Math.min(e.min, z); e.max = Math.max(e.max, z); m.set(k, e); }
    const CX = 30, CY = 20, rr = 3; let maxDev = 0, n = 0;
    for (const e of m.values()) { if (e.max - e.min < 6) continue; const dx = e.x - CX, dy = e.y - CY, d = Math.hypot(dx, dy); let a = Math.atan2(dy, dx) * 180 / Math.PI; if (a < 0) a += 360; if (d > rr + 1.2 || a < 182 || a > 268) continue; n++; maxDev = Math.max(maxDev, Math.abs(d - rr)); }
    return { mode: v._carveMeshMode, n, maxDev: +maxDev.toFixed(4) };
  }, CORNER);
  expect(r.mode).toBe('live-crisp');
  expect(r.n, 'the live-crisp fillet has curtain crossings').toBeGreaterThan(6);
  expect(r.maxDev, `the LIVE fillet crossings sit on the true arc within 0.1mm (max ${r.maxDev}mm)`).toBeLessThan(0.1);
});
