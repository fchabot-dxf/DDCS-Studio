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
