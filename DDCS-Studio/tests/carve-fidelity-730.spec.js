import { test, expect } from '@playwright/test';

/**
 * t730 — CARVE FIDELITY: the crisp end-state mesher (_buildCrispCarveMesh) now follows the ANALYTIC CONTOUR via a
 * marching-triangles trace of the floor iso on the AA field h[] (coverage 0.5 = the analytic edge). So a DIAGONAL pocket
 * wall renders STRAIGHT (not a grid staircase) and an internal corner ARCS at the tool radius (not a snapped sharp corner),
 * while straight runs stay crisp. These read the ACTUAL crisp mesh geometry (window.__gpPanel.viz._carveMesh) — the wall
 * "columns" = XY bins holding a rim vert AND a floor vert spanning the pocket depth (a true vertical curtain). Frame note:
 * the mesh geometry is centred (ox=−X/2), so +X/2,+Y/2 maps a vert back to STOCK coords (matching the G-code).
 */
test.use({ viewport: { width: 1300, height: 950 } });

const R_DEFAULT = 3;   // the carve's default tool radius (createPreviewPanel _carveTR = (dia || 6)/2) when the program sets no tool

const setup = (page) => page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 100, y: 80, z: 20, datum: 'nnp', features: [] }; s.preview = s.preview || {}; s.preview.autoLoop = false; s.preview.default3D = true; });

// Build the end-state crisp carve for `prog`, then return the wall COLUMNS (XY bins spanning ~the pocket depth) in STOCK coords.
async function wallColumns(page, prog) {
    await page.evaluate((g) => { const e = document.getElementById('editor'); if (e) e.value = g; if (window.setGcodeView) window.setGcodeView('3d'); }, prog);
    await page.waitForTimeout(400);
    await page.evaluate((g) => { const p = window.__gpPanel; if (p) p.setGcode(g); }, prog);
    await page.waitForTimeout(400);
    return page.evaluate(() => {
        const v = window.__gpPanel.viz; const g = v._carveMesh && v._carveMesh.geometry; if (!g) return null;
        const c = v._carve, HX = c.X / 2, HY = c.Y / 2;   // centred geometry → +X/2,+Y/2 back to stock coords
        const p = g.attributes.position, cols = new Map();
        for (let i = 0; i < p.count; i++) { const x = p.getX(i) + HX, y = p.getY(i) + HY, z = p.getZ(i); const key = (Math.round(x * 4) / 4) + ',' + (Math.round(y * 4) / 4); const e = cols.get(key) || { x, y, min: 1e9, max: -1e9 }; e.min = Math.min(e.min, z); e.max = Math.max(e.max, z); cols.set(key, e); }
        const walls = []; for (const e of cols.values()) { const d = e.max - e.min; if (d > 6 && d < 14) walls.push({ x: e.x, y: e.y }); }   // pocket-depth curtains (not the 20mm perimeter skirt)
        return { mode: v._carveMeshMode, maxWall: v._carveMaxWall, junctions: v._carveTriJunctions, walls };
    });
}

test('DIAGONAL wall is STRAIGHT: a 45° groove\'s wall fits a straight line (low residual), not a grid staircase', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await setup(page);
    // a single 45° feed pass (20,15)→(75,70): its two walls are straight lines parallel to the axis (x−y = 5), offset ±r√2
    const D = await wallColumns(page, 'G90\nG0 X20 Y15 Z5\nG1 Z-8 F300\nX75 Y70\nG0 Z5\nM30\n');
    expect(D, 'the diagonal groove built a crisp carve').not.toBeNull();
    expect(D.mode, 'settled end-state uses the crisp mesh').toBe('crisp');
    // one wall (below/right of the axis: x−y > 5), across the middle of the pass
    const side = D.walls.filter((w) => (w.x - w.y) > 8 && (w.x - w.y) < 18 && w.x > 24 && w.x < 71);
    expect(side.length, 'the wall is sampled along its length').toBeGreaterThan(40);
    const n = side.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const w of side) { sx += w.x; sy += w.y; sxx += w.x * w.x; sxy += w.x * w.y; }
    const m = (n * sxy - sx * sy) / (n * sxx - sx * sx), b = (sy - m * sx) / n;
    let rms = 0; for (const w of side) { const dd = (m * w.x - w.y + b) / Math.hypot(m, -1); rms += dd * dd; } rms = Math.sqrt(rms / n);
    const xr = Math.max(...side.map((w) => w.x)) - Math.min(...side.map((w) => w.x)), yr = Math.max(...side.map((w) => w.y)) - Math.min(...side.map((w) => w.y));
    expect(Math.abs(m - 1), `the wall runs at 45° (slope≈1, got ${m.toFixed(3)})`).toBeLessThan(0.08);
    expect(rms, `the wall is STRAIGHT — RMS residual off its best-fit line is sub-cell (got ${rms.toFixed(3)}mm), not a staircase`).toBeLessThan(0.35);
    expect(Math.min(xr, yr), 'the wall genuinely spans the diagonal in BOTH axes (not an axis-aligned segment)').toBeGreaterThan(25);
});

test('INTERNAL CORNER arcs at ~toolR: a pocket corner is a quarter-arc of radius r, not a snapped sharp corner', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await setup(page);
    // an OVERLAPPING raster (stepover 4 < the default Ø6 tool) clears a SOLID rect [30,66]×[20,44]; cleared = that rect
    // dilated by r=3 → each corner is a quarter-arc of radius 3 centred at the toolpath corner (here the BL corner (30,20)).
    const P = await wallColumns(page, 'G90\nG0 X30 Y20 Z5\nG1 Z-8 F300\nX66\nY24\nX30\nY28\nX66\nY32\nX30\nY36\nX66\nY40\nX30\nY44\nX66\nG0 Z5\nM30\n');
    expect(P, 'the pocket built a crisp carve').not.toBeNull();
    expect(P.junctions, 'no 3-level fallback triangles for a single-depth pocket (clean marching)').toBe(0);
    const CX = 30, CY = 20, r = R_DEFAULT;                     // arc centre = the toolpath corner; radius = the tool radius
    const sharp = { x: CX - r, y: CY - r };                    // the UNFILLETED corner (where the two straight walls would meet)
    const corner = P.walls.filter((w) => w.x >= CX - r - 2 && w.x <= CX + 0.5 && w.y >= CY - r - 2 && w.y <= CY + 0.5);
    expect(corner.length, 'the corner region has wall columns').toBeGreaterThan(6);

    // (a) the arc's 45° midpoint is present at radius r — a SHARP/snapped corner would have material out to `sharp`, nothing here
    const mid = { x: CX - r / Math.SQRT2, y: CY - r / Math.SQRT2 };
    const nearest = corner.reduce((best, w) => { const d = Math.hypot(w.x - mid.x, w.y - mid.y); return d < best.d ? { d, w } : best; }, { d: 1e9, w: null });
    expect(nearest.d, 'a wall column sits at the arc\'s 45° fillet midpoint (the corner is rounded, not sharp)').toBeLessThan(1.0);
    expect(Math.abs(Math.hypot(nearest.w.x - CX, nearest.w.y - CY) - r), 'that fillet column is at radius ≈ toolR from the corner').toBeLessThan(0.6);

    // (b) NO wall reaches the unfilleted sharp corner — the tool radius keeps the material a fillet away from it
    const minSharp = Math.min(...P.walls.map((w) => Math.hypot(w.x - sharp.x, w.y - sharp.y)));
    expect(minSharp, 'the fillet keeps all material clear of the unfilleted sharp corner (≈ r·(√2−1) away)').toBeGreaterThan(0.8);

    // (c) the corner TURNS through a quarter (a smooth arc sweeps ~90°, not a single sharp vertex): arc-radius columns span a
    // wide angular range about the centre
    const arc = corner.filter((w) => Math.abs(Math.hypot(w.x - CX, w.y - CY) - r) < 0.9);
    const angs = arc.map((w) => { let a = Math.atan2(w.y - CY, w.x - CX) * 180 / Math.PI; return a < 0 ? a + 360 : a; });
    expect(Math.max(...angs) - Math.min(...angs), 'the arc sweeps a wide angle (a rounded corner, not an axis-aligned snap)').toBeGreaterThan(55);
});

test('AFTER screenshots — the diagonal groove + the pocket corner render (crisp contour walls)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await setup(page);
    await wallColumns(page, 'G90\nG0 X20 Y15 Z5\nG1 Z-8 F300\nX75 Y70\nG0 Z5\nM30\n');
    { const b = await page.locator('#editor3d, .viz3d-drawer, canvas').first().boundingBox(); if (b) await page.screenshot({ path: 'scratchpad/carve_after_diagonal.png', clip: b }); }
    await wallColumns(page, 'G90\nG0 X30 Y20 Z5\nG1 Z-8 F300\nX66\nY24\nX30\nY28\nX66\nY32\nX30\nY36\nX66\nY40\nX30\nY44\nX66\nG0 Z5\nM30\n');
    { const b = await page.locator('#editor3d, .viz3d-drawer, canvas').first().boundingBox(); if (b) await page.screenshot({ path: 'scratchpad/carve_after_pocket.png', clip: b }); }
    expect(true).toBe(true);
});
