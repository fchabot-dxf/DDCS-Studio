import { test, expect } from '@playwright/test';

/**
 * t802 — CONCENTRIC FOR ALL POCKET SHAPES (the octagon case). Polygon + ellipse pockets now clear with TRUE concentric
 * inward offset rings (concentricContour over the existing offsetRegion), not the old silent raster fallback. circle + rect
 * keep their analytic kernels (byte-identity). No shape×strategy combo silently swaps. The 2D layout draws the rings, and
 * the preview boundary equals the emit kernel's boundary numerically per shape kind.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// parse "... X<n> Y<n> ..." coordinate pairs out of a G-code line array
function coords(lines) {
  const out = [];
  for (const ln of lines) { const m = /X(-?[\d.]+)\s+Y(-?[\d.]+)/.exec(ln); if (m) out.push({ x: +m[1], y: +m[2] }); }
  return out;
}

test('KERNEL: octagon concentric emits inward offset RINGS (count ~ inradius/stepover, radii decreasing ~step apart)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { concentricContour, regionInradius, offsetRegion } = await import('/wizards/ops/contour.js');
    const { pocketInsetRegion, trueRegionFromFlat } = await import('/wizards/ops/pocketfill.js');
    const p = { shape: 'polygon', originX: 0, originY: 0, dia: 80, sides: 8, toolDia: 6, wallOffset: 0, stepoverPct: 40 };
    const inset = pocketInsetRegion(p);
    const step = Math.max(0.2, Math.max(0.1, p.toolDia) * p.stepoverPct / 100);   // 2.4
    const lines = concentricContour(inset, step, { z: -2, clr: 5, feed: 600, plunge: 150 });
    const trueR = trueRegionFromFlat(p);
    return {
      lines, step,
      insetInradius: regionInradius(inset),
      trueInradius: regionInradius(trueR),
      outerRingR: inset.r,          // circumradius of the outermost (tool-inset) ring
      trueR: trueR.r,
    };
  });
  const pts = coords(r.lines);
  // rings = distinct distances-from-centre among the vertices (angle-independent; centre-finish point at ~0 excluded)
  const radii = [...new Set(pts.map((q) => Math.round(Math.hypot(q.x, q.y) * 10) / 10))].filter((d) => d > 0.2).sort((a, b) => b - a);
  const expected = r.insetInradius / r.step;
  expect(radii.length, `octagon concentric ring count (${radii.length}) ≈ inradius/stepover (${expected.toFixed(1)})`).toBeGreaterThan(expected - 2.5);
  expect(radii.length).toBeLessThan(expected + 2.5);
  expect(radii.length, 'clearly many rings, not a single wall pass').toBeGreaterThan(5);
  // outermost ring = the tool-inset boundary (circumradius); rings spaced ~ step/cos(π/8) apart (perpendicular step)
  expect(Math.abs(radii[0] - r.outerRingR), 'outermost ring == the tool-inset boundary circumradius').toBeLessThan(0.2);
  const gaps = radii.slice(1).map((x, i) => radii[i] - x);
  const nominal = r.step / Math.cos(Math.PI / 8);
  for (const g of gaps) expect(Math.abs(g - nominal), `ring spacing ≈ step/cos (nominal ${nominal.toFixed(2)})`).toBeLessThan(0.2);
});

test('EMIT no-silent-fallback: every shape × strategy emits its DECLARED pattern (concentric ≠ raster; polygon/ellipse concentric are rings)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const build = builderOf('user_pocket_data');
    const em = (p) => emitMapped(build(p)).text;
    const base = { originX: 0, originY: 0, toolDia: 6, stepoverPct: 40, depth: 4 };
    const sizes = { rect: { w: 80, h: 60 }, circle: { dia: 80 }, polygon: { dia: 80, sides: 8 }, ellipse: { w: 90, h: 60 } };
    const out = {};
    for (const shape of ['rect', 'circle', 'polygon', 'ellipse']) {
      const con = em({ ...base, ...sizes[shape], shape, strategy: 'spiral' });
      const ras = em({ ...base, ...sizes[shape], shape, strategy: 'raster' });
      out[shape] = { differ: con !== ras, conArcs: (con.match(/G3 /g) || []).length, conLen: con.length };
    }
    return out;
  });
  for (const shape of ['rect', 'circle', 'polygon', 'ellipse']) {
    expect(r[shape].differ, `${shape}: concentric emit DIFFERS from raster (no silent fallback)`).toBe(true);
  }
  expect(r.circle.conArcs, 'circle concentric uses G3 arcs (analytic kernel)').toBeGreaterThan(0);
});

test('P3+P4 LAYOUT + PERIMETER: the 2D preview draws the emit rings (one source); boundary == kernel boundary; outer pass == boundary − toolR', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { pocketPreviewGeometry } = await import('/blocks/dataOps/pocketData.js');
    const { trueRegionFromFlat, pocketInsetRegion, stepoverMm } = await import('/wizards/ops/pocketfill.js');
    const { concentricRings, regionInradius } = await import('/wizards/ops/contour.js');
    const maxR = (pts) => Math.max(...pts.map((q) => Math.hypot(q.x, q.y)));   // origin at 0,0
    // per-shape: preview boundary contour == kernel true boundary (same regionDesc → identical), for a centred shape
    const perShape = {};
    for (const [shape, sz] of [['circle', { dia: 80 }], ['polygon', { dia: 80, sides: 8 }], ['ellipse', { w: 90, h: 60 }]]) {
      const p = { shape, originX: 0, originY: 0, toolDia: 6, wallOffset: 0, stepoverPct: 40, strategy: 'spiral', ...sz };
      const geo = pocketPreviewGeometry(p);
      const trueR = trueRegionFromFlat(p);
      const trueMax = maxR((trueR.contour || [])[0] || [{ x: 0, y: 0 }]);
      perShape[shape] = { boundaryR: maxR(geo.paths[0].pts), trueMax, paths: geo.paths.length };
    }
    // octagon: preview rings == emit rings (count + outermost) + the perpendicular pass rule
    const p = { shape: 'polygon', originX: 0, originY: 0, dia: 80, sides: 8, toolDia: 6, wallOffset: 0, stepoverPct: 40, strategy: 'spiral' };
    const geo = pocketPreviewGeometry(p);
    const inset = pocketInsetRegion(p), trueR = trueRegionFromFlat(p);
    const emitRings = concentricRings(inset, stepoverMm(p));
    const previewRings = geo.paths.slice(1);   // paths[0] = boundary, rest = rings
    return {
      perShape,
      previewRingCount: previewRings.length, emitRingCount: emitRings.length,
      outerPreviewR: maxR(previewRings[0].pts), insetR: inset.r,
      trueApothem: regionInradius(trueR), insetApothem: regionInradius(inset), toolR: 3,
    };
  });
  for (const shape of ['circle', 'polygon', 'ellipse']) {
    expect(Math.abs(r.perShape[shape].boundaryR - r.perShape[shape].trueMax), `${shape}: preview boundary == kernel true boundary`).toBeLessThan(0.05);
  }
  expect(r.previewRingCount, 'the 2D layout draws EXACTLY the rings the emit cuts (one source)').toBe(r.emitRingCount);
  expect(r.previewRingCount, 'octagon draws many rings, not just the boundary').toBeGreaterThan(5);
  expect(Math.abs(r.outerPreviewR - r.insetR), 'the outermost drawn ring == the tool-inset boundary (== the outermost cut pass)').toBeLessThan(0.05);
  expect(Math.abs(r.insetApothem - (r.trueApothem - r.toolR)), 'outermost pass apothem == boundary apothem − toolR (± wallOffset=0)').toBeLessThan(0.05);
});

test('BYTE-IDENTITY unchanged: circle + rect concentric untouched (pocket-data-emit golden covers the full sweep)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const build = builderOf('user_pocket_data');
    let diffs = 0;
    for (const shape of ['rect', 'circle', 'polygon', 'ellipse']) {
      const p = { shape, originX: 0, originY: 0, w: 80, h: 60, dia: 80, sides: 8, strategy: 'spiral', toolDia: 6 };
      // t945 — seed the Head so the reference pocketStack spins up like the twin does at build (spindleHeadPatch) → M3 byte-matched.
      if (emitMapped(build(p)).text !== emitMapped(pocketStack({ ...p, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} })).text) diffs++;
    }
    return { diffs };
  });
  expect(r.diffs, 'twin == built-in pocketStack for concentric across all 4 shapes (the builder change is shared)').toBe(0);
});
