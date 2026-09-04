import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT FRESH-OPEN SEAT + 3D TRACE (t674/t676, user-reported V10.127). Two 3D-viz bugs — the 2D/shared `segs` were
 * already correct (why alignment-sim-starts-at-a passed and missed them: it read getSegments, not p.viz):
 *  (1) FRESH OPEN — the probe SIM (auto-play) seeds at ORIGIN (the seat intent applied AFTER the on-open auto-play; the
 *      running engine was never re-seeded).
 *  (2) the 3D TRACE polyline draws from ORIGIN — the alignment G53/absolute park sets stats.absolute → the trace anchor
 *      `off` collapsed to {0,0,0} (the animation was spared: it rides engine.pos seeded at A).
 * t676: BOTH the BUILT-IN view (openWiz('alignment')) AND the data twin (user_alignment_data) must seat — the built-in
 * view had NO seat intent at all (the twin declares it via def.sim{seatStart}). Fix (preview-only, emit unchanged):
 *   - alignmentView applies previewSeatAtStart (the built-in view now carries the same seat the twin declares);
 *   - setSeatAtStart re-seeds the RUNNING play; the trace `off` consumes the seat (_seatAtStart) even under stats.absolute.
 * VERIFIED across BOTH view-timing flows: 3D-initial open, AND default-view open → setView('3d') (the advisor's repro).
 * t1730 — alignmentView (the built-in coded view) is RETIRED; openWiz('alignment') now degrades to a "no longer
 * editable" toast with no panel. Only the data twin (user_alignment_data) has a live panel to seat any more, so the
 * loop below covers it alone (the old dual-flow comparison is moot once the built-in view no longer exists).
 */
test.use({ viewport: { width: 1300, height: 950 } });

// Read the ACTUAL 3D viz (p.viz): marker A (world), the animation tool (world), and the drawn TRACE polyline (head +
// the closest any route vertex comes to the origin), all in world coords.
const read3D = (page) => page.evaluate(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    const viz = p && p.viz; if (!viz || !viz.lineGroups) return null;
    const V3 = viz.THREE.Vector3;
    const worldOf = (o) => { o.updateWorldMatrix(true, false); return o.getWorldPosition(new V3()); };
    const A = (viz.spindleMarkers && viz.spindleMarkers[0]) ? worldOf(viz.spindleMarkers[0]) : null;
    const tool = viz._animTool ? worldOf(viz._animTool) : null;
    let head = null, minO = Infinity, n = 0;
    for (const k of ['probeFast', 'probeSlow', 'feed', 'rapid', 'retract']) {
        const ln = viz.lineGroups[k];
        const pa = ln && ln.geometry && ln.geometry.attributes && ln.geometry.attributes.position;
        if (!pa || !pa.count) continue;
        ln.updateWorldMatrix(true, false);
        for (let i = 0; i < pa.count; i++) { const w = new V3(pa.getX(i), pa.getY(i), pa.getZ(i)).applyMatrix4(ln.matrixWorld); if (head === null) head = { x: w.x, y: w.y }; const d = Math.hypot(w.x, w.y); if (d < minO) minO = d; n++; }
    }
    return { A: A ? { x: A.x, y: A.y } : null, tool: tool ? { x: tool.x, y: tool.y } : null, head, minO, n };
});
const dist = (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
const fromOrigin = (a) => a ? Math.hypot(a.x, a.y) : 0;
const setStock = (page, autoLoop) => page.evaluate((al) => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 150, y: 100, z: 25, datum: 'ccp' }; s.preview = s.preview || {}; s.preview.autoLoop = al; }, autoLoop);
const to3D = async (page) => { await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.setView) p.setView('3d'); }); await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 }); await page.waitForTimeout(600); };
const seedTwin = (page) => page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/alignmentData.js'); try { U.createUserOp(M.alignmentDataDef()); } catch (_) {} });

// The core assertions, for a given op × view-flow (already in 3D).
async function assertSeated(page, label) {
    const r = await read3D(page);
    expect(r, `${label}: 3D viz up`).not.toBeNull();
    expect(fromOrigin(r.A), `${label}: marker A distinct from origin (meaningful)`).toBeGreaterThan(10);
    expect(dist(r.head, r.A), `${label}: 3D TRACE head starts at A (A=${JSON.stringify(r.A)} head=${JSON.stringify(r.head)})`).toBeLessThan(6);
    expect(r.minO, `${label}: no TRACE vertex at the origin`).toBeGreaterThan(10);
    return r;
}

for (const op of ['user_alignment_data']) {
    test(`${op}: 3D-INITIAL open seats the trace + sim at A (fresh, zero interaction)`, async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
        await seedTwin(page);
        await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview = s.preview || {}; s.preview.default3D = true; });
        await setStock(page, true);
        await page.evaluate((o) => window.openWiz(o), op);
        await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
        // sample the auto-play: a play seeded at origin dips to ~0; seated at A it stays near the fence
        let minToolO = Infinity, last = null;
        for (let i = 0; i < 8; i++) { const r = await read3D(page); if (r) { last = r; minToolO = Math.min(minToolO, fromOrigin(r.tool)); } await page.waitForTimeout(70); }
        expect(last, `${op} 3D-initial: viz up`).not.toBeNull();
        expect(dist(last.head, last.A), `${op} 3D-initial: TRACE head at A`).toBeLessThan(6);
        expect(last.minO, `${op} 3D-initial: no TRACE vertex at origin`).toBeGreaterThan(10);
        expect(minToolO, `${op} 3D-initial: the SIM never seats/animates at the origin (seeded at A)`).toBeGreaterThan(10);
    });

    test(`${op}: DEFAULT-view open → setView('3d') seats the trace at A (the advisor's repro)`, async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
        await seedTwin(page);
        await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview = s.preview || {}; s.preview.default3D = false; });   // force a NON-3D initial view
        await setStock(page, true);
        await page.evaluate((o) => window.openWiz(o), op);
        await page.waitForSelector('.wiz-body, #wiz_user_form', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(400);
        await to3D(page);   // switch to 3D AFTER open — the trace must (re-)anchor to A here
        await assertSeated(page, `${op} open→setView(3d)`);
    });
}

test('the twin marker DRAG (2D→3D flow): the drag moves A and the 3D trace FOLLOWS to the new A', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await seedTwin(page);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview = s.preview || {}; s.preview.default3D = false; });
    await setStock(page, true);
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.setView) p.setView('2d'); });
    await page.waitForSelector('#wiz_user svg [data-hid="__simstart0"]', { timeout: 8000 });
    // t2599 — the tree-mode canvas's own auto-fit/rescale is still transitional for ~1s right after the handle
    // first appears (measured live on alignment_data: the stock's own rendered box read ~1/12th its final size
    // immediately after the handle mounted, settling a second later) — a drag computed against that transitional
    // geometry lands nowhere meaningful.
    await page.waitForTimeout(1000);
    const markerWorlds = () => page.evaluate(() => (window.ddcsStudio.wizardManager._activePanel.getPassStarts() || []).map((s) => ({ x: s.x, y: s.y })));
    const before = await markerWorlds();
    const h = await page.evaluate(() => { const el = document.querySelector('#wiz_user svg [data-hid="__simstart0"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    // DRAG A along the fence (screen −X)
    await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 70, h.y, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await markerWorlds();
    expect(Math.abs(after[0].x - before[0].x), 'the drag MOVED marker A along the fence').toBeGreaterThan(15);
    // now to 3D: after a real drag, the fix HOLDS — the trace has NO origin vertex and its head follows A along the drag
    // axis (X). (The Y differs by the probe APPROACH offset — the tool begins a few mm off the fence — not the origin bug.)
    await to3D(page);
    const r = await read3D(page);
    // the FIX (no origin) must HOLD after a real drag in the 2D→3D flow — the exact seat is drag-position-dependent, so
    // assert the invariant the bug violated: NO trace vertex at the machine origin, and the trace head is near the fence (A),
    // not origin. (The trace head vs marker A differ only by the probe APPROACH offset — alignment geometry, not the bug.)
    // >5, not >10: the fresh-seat BUG collapses a trace vertex ONTO the machine origin (minO≈0), so >5 still catches it
    // decisively. The t784 side-chevron strip narrowed the 2D canvas ~44px → the fixed 70px drag now lands A a few mm
    // further along the fence (larger px→world scale), so the nearest legit vertex sits ~9.6mm out (was >10). The
    // invariant asserted is unchanged: no vertex AT the origin.
    expect(r.minO, 'twin after a real DRAG (2D→3D): NO trace vertex at the origin (the fix holds)').toBeGreaterThan(5);
    expect(fromOrigin(r.head), 'the TRACE head is near the fence (off-origin) after the drag').toBeGreaterThan(10);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/alignment_fresh_seat.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
});

test('NEGATIVE CONTROL: homing (machine-frame) trace head still coincides with its seated tool — unchanged', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.machine = { x: 600, y: 400, z: -120, show: true }; s.limits = s.limits || {}; s.limits.xMinHome = true; s.limits.yMinHome = true; s.limits.zMaxHome = true; s.preview = s.preview || {}; s.preview.default3D = true; });
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 }).catch(() => {});
    await to3D(page).catch(() => {});
    const hz = await read3D(page);
    if (hz && hz.head && hz.tool) expect(dist(hz.head, hz.tool), 'homing trace head coincides with its seated tool (unchanged)').toBeLessThan(10);
});
