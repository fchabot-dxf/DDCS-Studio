import { test, expect } from '@playwright/test';

/**
 * MATERIAL REMOVAL E1 — real-symptom in the SHARED preview panel (the everywhere ruling). The carve lives in
 * createPreviewPanel/gcodeViz3d, so the EDITOR 3D preview AND every WIZARD preview inherit it. Reads the ACTUAL carve
 * map (p.viz._carve). The static END-STATE shows when NOT auto-playing; the LIVE progressive carve runs during play.
 */
test.use({ viewport: { width: 1300, height: 950 } });

const setup = (page, autoLoop) => page.evaluate((al) => {
    const s = window.ddcsGetSettings();
    s.stock = { show: true, x: 100, y: 80, z: 20, datum: 'nnp', features: [] };
    s.preview = s.preview || {}; s.preview.autoLoop = al; s.preview.default3D = true;
}, autoLoop);

const editorEndState = async (page, gcode) => {
    await page.evaluate((g) => { const e = document.getElementById('editor'); if (e) e.value = g; if (window.setGcodeView) window.setGcodeView('3d'); }, gcode);
    await page.waitForTimeout(400);
    await page.evaluate((g) => { const p = window.__gpPanel; if (p) p.setGcode(g); }, gcode);
    await page.waitForTimeout(300);
    return page.evaluate(() => { const c = window.__gpPanel && window.__gpPanel.viz && window.__gpPanel.viz._carve; return c ? { at: c.heightAt(30, 25), far: c.heightAt(75, 60), pristine: c.isPristine() } : null; });
};

test('EDITOR END-STATE: a drill drops the hole-centre cell to the plunge depth; a PROBE carves NOTHING', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await setup(page, false);   // no auto-play → the static END-STATE shows on setGcode
    const drill = await editorEndState(page, 'G90\nG0 X30 Y25 Z5\nG1 Z-8 F100\nG0 Z5\nM30\n');
    expect(drill, 'the editor 3D preview built a carve map').not.toBeNull();
    expect(drill.at, 'the drilled hole cell dropped to the plunge depth −8').toBeCloseTo(-8, 1);
    expect(drill.far, 'a cell far from the hole is full stock (0)').toBe(0);

    const probe = await editorEndState(page, 'G90\nG0 X30 Y25 Z5\nG31 Z-15 F50\nG0 Z5\nM30\n');
    // a PROBE program removes NO material → no carve is built at all (the plain stock box shows); if one lingers, it's pristine
    expect(probe === null || (probe.pristine && probe.at === 0), 'a PROBE program (G31) leaves the stock uncut (no carve map, or pristine)').toBe(true);
});

test('SURFACING END-STATE: a facing pass lowers the face cells (uniform material loss)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await setup(page, false);
    // a facing pass at Z=−1 sweeping ALONG Y=25 through the assertion point (30,25); default 6mm tool (r=3) covers it
    const r = await editorEndState(page, 'G90\nG0 X5 Y25 Z5\nG1 Z-1 F200\nX95\nG0 Z5\nM30\n');
    expect(r.at, 'a swept face cell is lowered to the pass Z (−1)').toBeCloseTo(-1, 1);
    expect(r.pristine, 'the face was cut (map not pristine)').toBe(false);
});

test('LIVE: play progressively removes material (monotone loss t0 → t-end), then settles at the end-state', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await setup(page, true);   // auto-play ON → the LIVE progressive carve
    await page.evaluate(() => { const e = document.getElementById('editor'); if (e) e.value = 'G90\nG0 X10 Y40 Z5\nG1 Z-3 F300\nX90\nG0 Z5\nX10 Y20\nG1 Z-3\nX90\nG0 Z5\nM30\n'; if (window.setGcodeView) window.setGcodeView('3d'); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const p = window.__gpPanel; if (p) p.setGcode(document.getElementById('editor').value); });
    const minH = () => page.evaluate(() => { const c = window.__gpPanel && window.__gpPanel.viz && window.__gpPanel.viz._carve; if (!c) return 0; let m = 0; for (let k = 0; k < c.h.length; k++) if (c.h[k] < m) m = c.h[k]; return m; });
    // sample the deepest cut over the run — it should monotonically drop from ~0 toward −3
    const samples = [];
    for (let i = 0; i < 10; i++) { samples.push(await minH()); await page.waitForTimeout(200); }
    const t0 = samples[0], tEnd = samples[samples.length - 1];
    expect(tEnd, 'by t-end the live carve has removed material (deepest ≈ −3)').toBeLessThan(-1);
    expect(tEnd, 'the deepest cut never overshoots the cut depth (−3)').toBeGreaterThanOrEqual(-3.2);
    // monotone: no sample is shallower than an earlier one by more than a rounding epsilon (material only removed, never restored mid-run)
    let monotone = true; for (let i = 1; i < samples.length; i++) if (samples[i] > samples[i - 1] + 0.01) monotone = false;
    expect(monotone, `live material loss is monotone (samples=${JSON.stringify(samples.map((s) => +s.toFixed(2)))})`).toBe(true);
});

test('CRISP WALLS (t682): a pocket end-state builds TRUE vertical wall faces (rim+floor share XY at depth), not a ramp', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await setup(page, false);   // no auto-play → the settled CRISP end-state
    // a rectangular pocket floor at Z=−8 (a Ø10 tool rasters it out), leaving vertical walls at the pocket boundary
    const prog = 'G90\nG0 X30 Y20 Z5\nG1 Z-8 F300\nX70\nY30\nX30\nY40\nX70\nY50\nX30\nY60\nX70\nG0 Z5\nM30\n';
    await page.evaluate((g) => { const e = document.getElementById('editor'); if (e) e.value = g; if (window.setGcodeView) window.setGcodeView('3d'); }, prog);
    await page.waitForTimeout(400);
    await page.evaluate((g) => { const p = window.__gpPanel; if (p) { p.setGcode(g); if (p.viz && p.viz.setTool) p.viz.setTool({ type: 'endmill', dia: 10 }); } }, prog);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
        const v = window.__gpPanel.viz; const g = v._carveMesh && v._carveMesh.geometry; if (!g) return null;
        const p = g.attributes.position; const cols = new Map();
        for (let i = 0; i < p.count; i++) { const kx = Math.round(p.getX(i) * 4) / 4, ky = Math.round(p.getY(i) * 4) / 4, z = p.getZ(i); const key = kx + ',' + ky; const e = cols.get(key) || { min: 1e9, max: -1e9 }; e.min = Math.min(e.min, z); e.max = Math.max(e.max, z); cols.set(key, e); }
        // a pocket-wall column: rim + floor share XY spanning ~the pocket depth (8), NOT the full stock height (20 = perimeter skirt)
        let pocketWalls = 0; for (const e of cols.values()) { const d = e.max - e.min; if (d > 6 && d < 14) pocketWalls++; }
        return { mode: v._carveMeshMode, maxWall: v._carveMaxWall, tri: v._carveTriCount, pocketWalls };
    });
    expect(r, 'the editor built a crisp end-state carve').not.toBeNull();
    expect(r.mode, 'the settled end-state uses the CRISP (vertical-wall) mesh').toBe('crisp');
    expect(r.maxWall, 'a vertical wall spans ~the pocket depth (8mm), not a sub-cell ramp').toBeGreaterThan(6);
    expect(r.pocketWalls, 'the mesh has vertical wall columns (rim+floor at the same XY spanning the pocket depth)').toBeGreaterThan(0);
});

test('BALL-NOSE (t682): a ball-nose tool (T3) NAMES the tip in the panel note + carves the spherical profile (one source: tool type)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await setup(page, false);
    // T3 is the default 6mm ball-nose; a facing cut with it → the note should name "ball-nose", and the carve is spherical
    const prog = 'G90\nT3\nG0 X20 Y40 Z5\nG1 Z-4 F300\nX80\nG0 Z5\nM30\n';
    await page.evaluate((g) => { const e = document.getElementById('editor'); if (e) e.value = g; if (window.setGcodeView) window.setGcodeView('3d'); }, prog);
    await page.waitForTimeout(400);
    await page.evaluate((g) => { window.__gpPanel.setGcode(g); }, prog);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
        const n = document.querySelector('.viz3d-drawer .pp-carve-note') || document.querySelector('.pp-carve-note');
        const c = window.__gpPanel.viz && window.__gpPanel.viz._carve;
        // spherical: the pass centre is deeper than a point 2mm off the axis (a flat tool would be equal)
        const centre = c ? c.heightAt(50, 40) : 0, off = c ? c.heightAt(50, 42.5) : 0;
        return { note: n && n.textContent, centre, off, has: !!c };
    });
    expect(r.has, 'the ball program built a carve').toBe(true);
    expect(r.note, 'the panel note names the ball-nose tip in use').toContain('ball-nose');
    expect(r.centre, 'the ball pass centre cuts to the tip depth (~−4)').toBeLessThan(-3);
    expect(r.off - r.centre, 'the ball flank is SHALLOWER off-axis than at the centre (spherical, not flat)').toBeGreaterThan(0.1);
});

test('EVERYWHERE: a WIZARD preview inherits the carve (a surfacing wizard removes material) + solid-look screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await setup(page, false);
    await page.evaluate(() => window.openWiz('surfacing'));
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.waitForTimeout(700);
    const w = await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; const c = p && p.viz && p.viz._carve; return c ? { has: true, pristine: c.isPristine() } : { has: false }; });
    expect(w.has, 'the WIZARD preview also built a carve map (the everywhere ruling — shared panel)').toBe(true);
    expect(w.pristine, 'a surfacing wizard removes material from the face (map not pristine)').toBe(false);
    await page.locator('.wiz-viz3d').first().screenshot({ path: 'scratchpad/stock-removal-surfacing.png' });
});
