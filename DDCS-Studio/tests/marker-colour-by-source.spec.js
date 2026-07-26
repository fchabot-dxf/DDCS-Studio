import { test, expect } from '@playwright/test';

// LAST middle refinement: each start marker is coloured by its reposition SOURCE — an AUTO-traverse start = CYAN
// (kept), a MANUAL-jog start = AMBER. The trace tags each pass from its REPOSITION message ('auto-traverse…'→auto /
// 'jog clear…'→manual); the 2D + 3D start markers colour per-pass. (Perceptibility = human eyes.)
test.use({ viewport: { width: 1280, height: 900 } });

test('trace tags each pass source from its REPOSITION (auto-traverse vs operator jog)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const w = new MiddleWizard();
    const base = { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', stockX: 100, stockY: 80, stockZ: 20 };
    const st = { stock: { x: 100, y: 80, z: 20, shape: 'boss' } };
    return {
      auto: traceToolpath(w.generate({ ...base, inAxis: 'auto', transAxis: 'auto' }), st).stats.passSources,
      manual: traceToolpath(w.generate({ ...base, inAxis: 'manual', transAxis: 'manual' }), st).stats.passSources,
      mixed: traceToolpath(w.generate({ ...base, inAxis: 'auto', transAxis: 'manual' }), st).stats.passSources,
    };
  });
  expect(r.auto, 'auto-both: pass0 + the auto trans-traverse').toEqual(['auto', 'auto']);
  expect(r.manual, 'manual-both: pass0 + 3 operator jogs').toEqual(['auto', 'manual', 'manual', 'manual']);
  expect(r.mixed, 'in-axis auto + trans manual: pass0 + the manual trans').toEqual(['auto', 'manual']);
});

test('3D start markers: pass-0 Start = amber; later passes colour by source (auto=cyan, manual=amber)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._passCount = 3; viz._ensureMarkers(); viz._highlightSelectedStart();
    viz.setStartSources(['auto', 'auto', 'manual']);
    return { c0: viz.spindleMarkers[0].children[0].material.color.getHex(), c1: viz.spindleMarkers[1].children[0].material.color.getHex(), c2: viz.spindleMarkers[2].children[0].material.color.getHex() };
  });
  // t293 — pass-0 is ALWAYS the operator jog Start → amber (even at an 'auto' source); later passes follow their source.
  expect(r.c0, 'pass 0 (the Start) = amber').toBe(0xffb300);
  expect(r.c1, 'pass 1 (auto reposition) = cyan').toBe(0x22d3ee);
  expect(r.c2, 'pass 2 (manual reposition) = amber').toBe(0xffb300);
});

// The 3D draws a dashed inter-pass jog (prevEnd → this pass's start anchor). A MANUAL reposition IS an operator jog, so
// it draws; an AUTO traverse is hands-free (its diagonal IS the connecting move) so the jog is a PHANTOM — it must NOT
// draw (the dashed line "after the diag to ②" the user flagged). gcodeViz3d gates the jog on the per-pass SOURCE.
test('3D inter-pass jog: AUTO traverse draws NO jog line; MANUAL keeps its jog', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._anchorToStart = true;
    viz.starts = [{ x: 0, y: 0, z: 0 }, { x: 50, y: -50, z: 0 }];
    // 2 passes, each with a move (so pass 0 produces a prevEnd that the pass-1 jog would bridge to ②)
    const parsed = { stats: { passes: 2 }, segments: [
      { x1: 0, y1: 0, z1: 0, x2: 10, y2: 0, z2: 0, type: 'rapid', pass: 0 },
      { x1: 0, y1: 0, z1: 0, x2: 0, y2: 10, z2: 0, type: 'rapid', pass: 1 },
    ] };
    viz.setStartSources(['auto', 'auto']); viz.setSegments(parsed, false);
    const autoJog = !!viz.lineGroups.jog;
    viz.setStartSources(['auto', 'manual']); viz.setSegments(parsed, false);
    const manualJog = !!viz.lineGroups.jog;
    return { autoJog, manualJog };
  });
  expect(r.autoJog, 'AUTO traverse → no phantom jog line').toBe(false);
  expect(r.manualJog, 'MANUAL reposition → keeps its jog line').toBe(true);
});

// The MANUAL jog is a pronounced UPWARD 'rainbow' arc in the 3D view (the operator lifts, arcs over the stock, drops) —
// the 3D twin of the 2D canvas's upward-bow (t89). It's a sampled polyline (not a single straight segment) whose apex
// rises in +Z well above the two endpoints (which sit at the same low/scan Z here). AUTO stays straight (no jog at all).
test('3D manual jog BOWS UP in +Z (rainbow arc), not a straight line', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._anchorToStart = true;
    viz.starts = [{ x: 0, y: 0, z: 0 }, { x: 50, y: -50, z: 0 }];   // both pass ends/starts at z=0 → any +Z is the bow
    const parsed = { stats: { passes: 2 }, segments: [
      { x1: 0, y1: 0, z1: 0, x2: 10, y2: 0, z2: 0, type: 'rapid', pass: 0 },   // prevEnd = (10,0,0)
      { x1: 0, y1: 0, z1: 0, x2: 0, y2: 10, z2: 0, type: 'rapid', pass: 1 },   // pass-1 start anchor = (50,-50,0)
    ] };
    viz.setStartSources(['auto', 'manual']); viz.setSegments(parsed, false);
    const pos = viz.lineGroups.jog && viz.lineGroups.jog.geometry.attributes.position.array;
    if (!pos) return { hasJog: false };
    let maxZ = -Infinity, minZ = Infinity;
    for (let i = 2; i < pos.length; i += 3) { if (pos[i] > maxZ) maxZ = pos[i]; if (pos[i] < minZ) minZ = pos[i]; }
    const jogHex = viz.lineGroups.jog.material && viz.lineGroups.jog.material.color && viz.lineGroups.jog.material.color.getHex();
    return { hasJog: true, verts: pos.length / 3, maxZ, minZ, jogHex };
  });
  expect(r.hasJog, 'manual → a jog line exists').toBe(true);
  expect(r.verts, 'the jog is a sampled polyline (many vertices), not a single 2-point segment').toBeGreaterThan(4);
  expect(r.minZ, 'the jog endpoints sit at the low/scan Z (≈0)').toBeLessThan(0.001);
  expect(r.maxZ, 'the jog APEX rises well above the flat chord (a pronounced +Z rainbow bow)').toBeGreaterThan(5);
  expect(r.jogHex, 'the 3D jog line renders the ORANGE-RED token (t331 #ff4500 — reads PATH_TYPES.jog.color, one edit both previews)').toBe(0xff4500);
});

test('2D path colours a HORIZONTAL rapid as LIFTED safe-travel (the rapid hue, dashed) — an AUTO trans-axis traverse + an in-axis rapid are BOTH lifted; only a MANUAL trans-axis jog is amber', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { createToolpath2d, segColor } = await import('/viz/toolpath2d.js');
    const { PATH_TYPES, hexCss } = await import('/viz/pathStyle.js');
    const diagSeg = { x1: -40, y1: -40, x2: 40, y2: 40, z1: 0, z2: 0, type: 'rapid', pass: 0 };   // 2-axis horizontal rapid = the trans-axis traverse
    const inSeg = { x1: -40, y1: -40, x2: 40, y2: -40, z1: 0, z2: 0, type: 'rapid', pass: 0 };     // 1-axis horizontal rapid = in-axis
    const mk = (source) => {   // paint it → sample the brightest pixel in a band above the chord (the MANUAL arc bows UP in amber)
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99999';
      document.body.appendChild(cv);
      const t2 = createToolpath2d(cv, {});
      t2.setMachine(null); t2.setAnchor(true);
      t2.setStarts([{ x: 0, y: 0, z: 0 }]); t2.setStartSources([source]);
      t2.setSegments([diagSeg, inSeg]);
      t2.fit();
      const v = cv.__t2view, ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
      const scan = (x1, y1, x2, y2) => { let best = [0, 0, 0]; for (let k = 0; k <= 40; k++) { const u = k / 40, wx = x1 + (x2 - x1) * u, wy = y1 + (y2 - y1) * u; for (let up = 14; up <= 44; up += 2) { const d = ctx.getImageData(Math.round((v.ox + wx * v.scale) * dpr), Math.round((v.oy - wy * v.scale) * dpr) - up, 1, 1).data; if (d[3] > 40 && d[0] + d[1] + d[2] > best[0] + best[1] + best[2]) best = [d[0], d[1], d[2]]; } } return best; };
      // t1205 — sample ONLY well ABOVE the straight chord: since the traverse became a bright yellow, a band that
      // includes the chord itself returns the TRAVERSE as "brightest" and the jog test measured the wrong line.
      // The manual jog is the only thing that BOWS up here, so this isolates it.
      const out = scan(-40, -40, 40, 40);
      cv.remove();
      return out;
    };
    return {
      diagColor: segColor(diagSeg, 0, 1, 0), inColor: segColor(inSeg, 0, 1, 0),   // the render TYPE colour (motion-type, source-independent) — robust
      liftedHex: hexCss(PATH_TYPES.lifted.color), rapidHex: hexCss(PATH_TYPES.rapid.color),
      liftedDash: PATH_TYPES.lifted.dash, rapidDash: PATH_TYPES.rapid.dash, jogHex: hexCss(PATH_TYPES.jog.color),
      manualDiag: mk('manual'),   // the MANUAL arc paints amber (bright, samplable)
    };
  });
  // A horizontal rapid is LIFTED SAFE-TRAVEL: segColor paints the AUTO trans-axis traverse + the in-axis rapid through the
  // `lifted` TYPE (motion-type, source-independent) — never the probe/feed colours.
  expect(r.diagColor, 'AUTO trans-axis traverse → the lifted safe-travel colour').toBe(r.liftedHex);
  expect(r.inColor, 'in-axis horizontal rapid → lifted too (same motion-type colour)').toBe(r.liftedHex);
  // t1203 (USER, supersedes t893's grey): a traverse IS a rapid, so it now renders the RAPID HUE — the 3D always did, and the
  // 2D-only grey was the divergence. The DASH (not a second colour) is what keeps it distinct from a solid positioning rapid.
  expect(r.liftedHex, 'safe-travel shares the rapid hue → the 2D matches the 3D convention').toBe(r.rapidHex);
  expect(r.liftedDash.length, 'safe-travel is DASHED').toBeGreaterThan(0);
  expect(r.rapidDash, 'a positioning rapid is SOLID → still distinguishable at a glance').toEqual([]);
  expect(r.jogHex, 'a MANUAL jog keeps its OWN colour token, distinct from the traverse').not.toBe(r.liftedHex);
  // Only the MANUAL trans-axis jog stays ORANGE-RED (its jog colour + the rainbow arc override the lifted style).
  // t1205 — the old discriminator was `red > blue`, which went VACUOUS when the traverse became yellow (#ffcc00 passes
  // it just as well as #ff4500). GREEN is what actually separates them: jog G/R ~= 0.27, traverse-yellow G/R ~= 0.8.
  expect(r.manualDiag[0], 'the sampled manual-jog pixel is red-dominant').toBeGreaterThan(r.manualDiag[2]);
  expect(r.manualDiag[1], 'MANUAL trans-axis jog is ORANGE-RED (green well below red) — NOT the yellow traverse hue').toBeLessThan(r.manualDiag[0] * 0.6);
});

test('2D start markers carry the per-pass source (auto / manual)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99999';
    document.body.appendChild(cv);
    const t2 = createToolpath2d(cv, {});
    t2.setMachine(null); t2.setAnchor(true);
    t2.setStarts([{ x: -30, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }]);
    t2.setStartSources(['auto', 'manual']);
    t2.setSegments([]); t2.fit();
    const m = (cv.__t2starts || []).map((s) => s.source);
    cv.remove();
    return m;
  });
  expect(r, '2D markers carry their source → drawStartHandles colours cyan/amber').toEqual(['auto', 'manual']);
});
