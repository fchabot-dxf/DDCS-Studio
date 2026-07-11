import { test, expect } from '@playwright/test';

/**
 * t738/t740 Phase 1 — THE PREVIEW VISIBILITY MODAL (3D half). ONE declared registry (displayPrefs) of {id,label,visible,
 * alpha} elements consumed by the 3D renderer via gcodeViz3d.applyDisplay: toggling hides an element live + the alpha
 * slider changes its material opacity (composed onto the probe/play scales). The machine envelope draws EVERYWHERE (a
 * declared box, default-on) at the sceneFrame machine-frame position, gated by the modal's `envelope` element (not
 * machine.show). Prefs persist app-wide in localStorage (like the theme). View-only → emit byte-identical.
 */
test.use({ viewport: { width: 1300, height: 950 } });

const setup = (page, machine) => page.evaluate((m) => {
    const s = window.ddcsGetSettings();
    s.stock = { show: true, x: 100, y: 80, z: 20, datum: 'nnp', features: [] };
    if (m) s.machine = m;
    s.preview = s.preview || {}; s.preview.autoLoop = false; s.preview.default3D = true;
}, machine);

const editorEnd = async (page, gcode) => {
    await page.evaluate((g) => { const e = document.getElementById('editor'); if (e) e.value = g; if (window.setGcodeView) window.setGcodeView('3d'); }, gcode);
    await page.waitForTimeout(350);
    await page.evaluate((g) => { const p = window.__gpPanel; if (p) p.setGcode(g); }, gcode);
    await page.waitForTimeout(350);
};

test('the modal opens on the editor + a mill twin + a probe twin; toggle + alpha apply LIVE (3D)', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView && window.openWiz);
    await setup(page);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview.carve = false; });   // carve off → the stock BOX is the stock (a cutting program would else swap it for the grid)
    await editorEnd(page, 'G90\nG0 X10 Y10 Z5\nG1 Z-2 F200\nX70\nY60\nG0 Z5\nM30\n');

    // the 👁 button is on the shared panel → it appears on the editor preview
    await expect(page.locator('#editor3d .pp-vis, .viz3d-drawer .pp-vis, .pp-vis').first()).toBeVisible();

    // open the modal → 11 element rows
    await page.locator('.pp-vis').first().click();
    await page.waitForSelector('.vis-modal-pop', { timeout: 4000 });
    const nRows = await page.locator('.vis-modal-pop .vis-row').count();
    expect(nRows, 'the modal lists all 11 declared elements').toBe(11);

    // baseline: stock + cut + tool visible in the 3D
    const before = await page.evaluate(() => { const v = window.__gpPanel.viz; return { stock: !!(v.stockMesh && v.stockMesh.visible), stockOp: v.stockMesh && v.stockMesh.material.opacity, cut: !!(v.lineGroups.feed && v.lineGroups.feed.visible), tool: !!(v._animParts && v._animParts.tool && v._animParts.tool.visible) }; });
    expect(before.stock).toBe(true);

    // TOGGLE stock OFF via the modal checkbox → the 3D stock hides LIVE
    await page.locator('.vis-modal-pop .vis-row[data-id="stock"] [data-vis]').uncheck();
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => !!(window.__gpPanel.viz.stockMesh && window.__gpPanel.viz.stockMesh.visible)), 'toggling stock hides it live').toBe(false);

    // TOGGLE cut OFF → the feed line group hides
    await page.locator('.vis-modal-pop .vis-row[data-id="cut"] [data-vis]').uncheck();
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => !!(window.__gpPanel.viz.lineGroups.feed && window.__gpPanel.viz.lineGroups.feed.visible)), 'toggling cut hides the feed group').toBe(false);

    // ALPHA slider on cut → re-enable + set 0.3 → the feed material opacity is 0.3 (value asserted, not just a screenshot)
    await page.locator('.vis-modal-pop .vis-row[data-id="cut"] [data-vis]').check();
    await page.evaluate(() => { const r = document.querySelector('.vis-modal-pop .vis-row[data-id="cut"] [data-alpha]'); r.value = '0.3'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(150);
    const cutOp = await page.evaluate(() => window.__gpPanel.viz.lineGroups.feed.material.opacity);
    expect(cutOp, 'the cut alpha slider set the feed opacity to 0.3').toBeCloseTo(0.3, 2);

    // the 👁 button is ALSO present on a mill twin + a probe twin (the shared panel)
    await page.evaluate(() => window.openWiz('surfacing'));
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('.pp-vis')); }, null, { timeout: 8000 });
    expect(await page.evaluate(() => !!document.querySelector('.wiz-viz3d .pp-vis')), 'the visibility button is on a mill twin preview').toBe(true);
    await page.evaluate(() => window.closeWiz && window.closeWiz());
    await page.evaluate(() => window.openWiz('corner'));
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('.pp-vis')); }, null, { timeout: 8000 });
    expect(await page.evaluate(() => !!document.querySelector('.wiz-viz3d .pp-vis')), 'the visibility button is on a probe twin preview').toBe(true);
});

test('ENVELOPE EVERYWHERE: the declared box draws at the sceneFrame machine-frame position + the modal toggle removes it', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    // reset the display prefs so envelope is at its default (visible) for this run
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.resetDisplay(); });
    // a dump-like machine: 400×300×-120 travel, workOrigin 0 (a valid DECLARED envelope)
    const MACHINE = { x: 400, y: 300, z: -120, show: false, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
    await setup(page, MACHINE);
    await editorEnd(page, 'G90\nG54\nG0 X20 Y20 Z5\nG1 Z-3 F200\nX120\nY90\nG0 Z5\nM30\n');   // an ABSOLUTE (mill) program

    // the envelope box exists (default-on, even with machine.show=false) at the machine-frame position |travel|/2 (home at scene 0)
    const env = await page.evaluate(() => { const v = window.__gpPanel.viz; const b = v.machineBox; return b ? { present: true, x: b.position.x, y: b.position.y, z: b.position.z, op: b.material.opacity } : { present: false }; });
    expect(env.present, 'the declared envelope draws by default (not gated on machine.show)').toBe(true);
    expect(env.x, 'box X-centre = sx/2 (machine-frame, home at scene 0)').toBeCloseTo(200, 1);
    expect(env.y, 'box Y-centre = sy/2').toBeCloseTo(150, 1);
    expect(env.z, 'box Z-centre = sz/2 (signed travel)').toBeCloseTo(-60, 1);
    expect(env.op, 'box opacity = the envelope element alpha (default 0.4)').toBeCloseTo(0.4, 2);

    // toggle the envelope OFF via the registry → the box hides live
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.setDisplayElement('envelope', { visible: false }); });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => { const b = window.__gpPanel.viz.machineBox; return !b || !b.visible; }), 'the envelope element toggle removes the box').toBe(true);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.resetDisplay(); });
});

test('G53 NEGATIVE CONTROL + prefs persistence: envelope ON does not break the start-anchor; prefs survive a reload', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.resetDisplay(); });
    await setup(page, { x: 400, y: 300, z: -120, show: false, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } });
    // an anchored/absolute op that used to SUPPRESS the envelope (a probe-style G31) — envelope now draws, start stays anchored
    await editorEnd(page, 'G90\nG0 X30 Y25 Z5\nG31 Z-15 F50\nG0 Z5\nM30\n');
    const r = await page.evaluate(() => { const p = window.__gpPanel; const v = p.viz; const sp = p.getStartPos ? p.getStartPos() : null; return { env: !!(v.machineBox && v.machineBox.visible), start: sp }; });
    expect(r.env, 'the envelope draws even on an anchored/probe preview (everywhere)').toBe(true);
    expect(r.start, 'the start is still anchored (the G53/anchor handling is untouched)').not.toBeNull();
    expect(Number.isFinite(r.start.x) && Number.isFinite(r.start.y), 'the start position resolved (not broken by the envelope)').toBe(true);

    // PERSISTENCE: set a pref, reload, assert it survived (localStorage, app-wide like the theme)
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.setDisplayElement('tool', { visible: false, alpha: 0.5 }); });
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio);
    const persisted = await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); return m.displayOf('tool'); });
    expect(persisted.visible, 'the tool visible pref survived reload').toBe(false);
    expect(persisted.alpha, 'the tool alpha pref survived reload').toBeCloseTo(0.5, 2);
    await page.evaluate(async () => { const m = await import('/viz/displayPrefs.js'); m.resetDisplay(); });
});
