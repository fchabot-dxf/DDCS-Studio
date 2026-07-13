import { test, expect } from '@playwright/test';

/**
 * t814 E1.7 (1) — ANALYTIC-ARC CORNERS. The t730 marching-triangles crisp mesher put each wall iso-vertex on a CELL EDGE
 * (a linear interp of h[]), so a corner fillet chorded through ~½-cell-off points → visible facets (the user's red-circled
 * outside corner). The coverage-½ iso IS the analytic tool-offset boundary, and at a corner that boundary is a true ARC of
 * radius toolR about the TOOLPATH VERTEX. _buildCrispCarveMesh now SNAPS each crossing onto that exact circle when its
 * closest toolpath feature is a corner vertex at ≈ toolR — rounding corners at ZERO grid cost. Facet count is irrelevant;
 * the max deviation of the wall from the true arc is what matters.
 */
test.use({ viewport: { width: 1300, height: 950 } });

const setup = (page) => page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 100, y: 80, z: 20, datum: 'nnp', features: [] }; s.preview = s.preview || {}; s.preview.autoLoop = false; s.preview.default3D = true; });

// Build the end-state crisp carve, then return the CURTAIN crossings (exact-XY keyed rim+floor pairs spanning the pocket
// depth — the true wall contour, NOT floor/top grid corners) in STOCK coords, plus mode.
async function curtainVerts(page, prog) {
  await page.evaluate((g) => { const e = document.getElementById('editor'); if (e) e.value = g; if (window.setGcodeView) window.setGcodeView('3d'); }, prog);
  await page.waitForTimeout(400);
  await page.evaluate((g) => { window.__gpPanel.setGcode(g); }, prog);
  await page.waitForTimeout(500);   // let the DEFERRED end-state crisp carve run
  return page.evaluate(() => {
    const v = window.__gpPanel.viz, g = v._carveMesh && v._carveMesh.geometry; if (!g) return null;
    const c = v._carve, HX = c.X / 2, HY = c.Y / 2, p = g.attributes.position, m = new Map();
    // exact-XY key: a curtain crossing appears at BOTH the rim (zHi) and floor (zLo) — same XY; a flat-tile grid corner is one Z.
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + HX, y = p.getY(i) + HY, z = p.getZ(i); const k = x.toFixed(3) + ',' + y.toFixed(3); const e = m.get(k) || { x, y, min: 1e9, max: -1e9 }; e.min = Math.min(e.min, z); e.max = Math.max(e.max, z); m.set(k, e); }
    const walls = []; for (const e of m.values()) if (e.max - e.min > 6 && e.max - e.min < 14) walls.push({ x: e.x, y: e.y });
    return { mode: v._carveMeshMode, walls, maxWall: v._carveMaxWall };
  });
}

test('a pocket corner fillet snaps onto the TRUE arc — max deviation < 0.1mm (facet count irrelevant)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
  await setup(page);
  // the t730 overlapping raster clears a solid rect [30,66]×[20,44]; the BL corner is a quarter-arc of r=3 about (30,20)
  const D = await curtainVerts(page, 'G90\nG0 X30 Y20 Z5\nG1 Z-8 F300\nX66\nY24\nX30\nY28\nX66\nY32\nX30\nY36\nX66\nY40\nX30\nY44\nX66\nG0 Z5\nM30\n');
  expect(D, 'the pocket built a crisp carve').not.toBeNull();
  expect(D.mode).toBe('crisp');
  const CX = 30, CY = 20, r = 3;
  // the BL fillet wedge (angles 182–268° about the corner), on the arc band — the true wall contour there
  const arc = D.walls.filter((w) => { const dx = w.x - CX, dy = w.y - CY, d = Math.hypot(dx, dy); let a = Math.atan2(dy, dx) * 180 / Math.PI; if (a < 0) a += 360; return d < r + 1.2 && a >= 182 && a <= 268; });
  expect(arc.length, 'the fillet arc has curtain crossings across its sweep').toBeGreaterThan(6);
  let maxDev = 0; for (const w of arc) maxDev = Math.max(maxDev, Math.abs(Math.hypot(w.x - CX, w.y - CY) - r));
  expect(maxDev, `every fillet crossing sits on the true arc within 0.1mm (max ${maxDev.toFixed(4)}mm)`).toBeLessThan(0.1);
  // and the arc genuinely sweeps a wide angle (a rounded corner, not one snapped vertex)
  const angs = arc.map((w) => { let a = Math.atan2(w.y - CY, w.x - CX) * 180 / Math.PI; return a < 0 ? a + 360 : a; });
  expect(Math.max(...angs) - Math.min(...angs), 'the fillet sweeps a wide arc').toBeGreaterThan(55);
});

test('STRAIGHT walls are untouched by the snap — a diagonal groove wall stays straight (low RMS)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
  await setup(page);
  const D = await curtainVerts(page, 'G90\nG0 X20 Y15 Z5\nG1 Z-8 F300\nX75 Y70\nG0 Z5\nM30\n');
  const side = D.walls.filter((w) => (w.x - w.y) > 8 && (w.x - w.y) < 18 && w.x > 24 && w.x < 71);
  expect(side.length, 'the diagonal wall is sampled').toBeGreaterThan(30);
  const n = side.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const w of side) { sx += w.x; sy += w.y; sxx += w.x * w.x; sxy += w.x * w.y; }
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx), b = (sy - m * sx) / n;
  let rms = 0; for (const w of side) { const dd = (m * w.x - w.y + b) / Math.hypot(m, -1); rms += dd * dd; } rms = Math.sqrt(rms / n);
  expect(rms, `the straight wall stays straight after the corner snap (RMS ${rms.toFixed(3)}mm)`).toBeLessThan(0.35);
});
