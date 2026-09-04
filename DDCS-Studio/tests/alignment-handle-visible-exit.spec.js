import { test, expect } from '@playwright/test';

/**
 * t532 — REPRODUCE the human's EXACT symptom: on the REAL alignment 2D canvas, drag a probe handle PAST the stock edge and
 * watch the VISIBLE marker (its SCREEN position vs the drawn stock rect), NOT a param value. Large envelope (600) + small
 * stock (150×100) so reachability is not the limit. Reports what the marker does + asserts it ends VISIBLY outside the rect.
 *
 * t2567 (BACKLOG #64/#65) — t532's own mid-drag auto-pan (the mechanism that kept the marker inside the visible
 * canvas while dragging far) was REMOVED, an owner-approved trade: that pan was ALSO what silently compounded a
 * small drag into a wildly wrong written value (severe, unbounded, and invisible) — see WORK-LOG t2567. The
 * marker CAN now genuinely leave the visible container mid-drag; it still lands well past the stock, both
 * during (screen-pinned at the viewport edge, past the stock, just no longer inside the CONTAINER too) and
 * after release (t2563's own refit-on-drop, unaffected by this removal, still brings it back into view). Only
 * the ONE assertion that encoded "stays inside the container while dragging" changed below — everything else
 * this test's own name claims (exits the stock, both live and settled) is unchanged and still holds.
 */
test.use({ viewport: { width: 1400, height: 1000 } });
test('a real canvas drag moves the VISIBLE marker OUTSIDE the drawn stock rect (not stuck at the edge)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => {
        const SP = await import('/ui/settingsPanel.js');
        SP.applySettings({ stock: { x: 150, y: 100, z: 25, shape: 'box', show: true }, machine: { x: 600, y: 600, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 } } });
    });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('[id*="userVizContainer"]:has([data-hid]) [data-hid="__simstart0"]'), null, { timeout: 8000 });
    await page.waitForTimeout(300);

    const rectOf = (sel) => page.locator(sel).first().boundingBox();
    const stock0 = await rectOf('[id*="userVizContainer"]:has([data-hid]) .fc-stock');
    const hb0 = await rectOf('[id*="userVizContainer"]:has([data-hid]) [data-hid="__simstart0"]');
    const cont = await rectOf('[id*="userVizContainer"]:has([data-hid])');

    // DRAG handle A hard to the RIGHT — toward + BEYOND the canvas edge (past where the frozen viewBox used to strand it).
    // Many steps so the edge auto-pan accumulates (each near-edge step pans the view to keep following the handle).
    const targetX = Math.min(1395, cont.x + cont.width + 200);   // beyond the container's right edge
    const targetY = hb0.y + hb0.height / 2;
    await page.mouse.move(hb0.x + hb0.width / 2, hb0.y + hb0.height / 2);
    await page.mouse.down();
    for (let k = 0; k < 6; k++) await page.mouse.move(targetX, targetY, { steps: 8 });   // hold at the edge → the auto-pan keeps scrolling the handle out

    // DURING the drag (before mouse.up) — the auto-pan must keep the marker VISIBLE in the canvas + far past the stock edge
    const during = await page.evaluate(() => {
        const h = document.querySelector('[id*="userVizContainer"]:has([data-hid]) [data-hid="__simstart0"]');
        const s = document.querySelector('[id*="userVizContainer"]:has([data-hid]) .fc-stock');
        if (!h || !s) return null;
        const hr = h.getBoundingClientRect(), sr = s.getBoundingClientRect();
        const cr = document.querySelector('[id*="userVizContainer"]:has([data-hid])').getBoundingClientRect();
        const hCx = hr.x + hr.width / 2;
        return { hCx, stockRight: sr.x + sr.width, contRight: cr.x + cr.width, hVisibleInCanvas: hr.width > 0 && hCx >= cr.x - 2 && hCx <= cr.x + cr.width + 2 };
    });
    const axDuring = await page.evaluate(async () => { const { getLastOp } = await import('/blocks/opRecord.js'); const o = getLastOp(); return o && o.params ? o.params.ax : null; });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // AFTER mouse.up (the view re-fits) — where is the marker vs the stock rect on-screen?
    const after = await page.evaluate(() => {
        const h = document.querySelector('[id*="userVizContainer"]:has([data-hid]) [data-hid="__simstart0"]');
        const s = document.querySelector('[id*="userVizContainer"]:has([data-hid]) .fc-stock');
        if (!h || !s) return null;
        const hr = h.getBoundingClientRect(), sr = s.getBoundingClientRect();
        return { hCx: hr.x + hr.width / 2, stockRight: sr.x + sr.width, stockLeft: sr.x, outside: (hr.x + hr.width / 2) > (sr.x + sr.width) };
    });
    const rec = await page.evaluate(async () => { const { getLastOp } = await import('/blocks/opRecord.js'); const o = getLastOp(); return o && o.params ? o.params.ax : null; });

    // BOTH SURFACES (the human: "maybe it's a gui or sim problem") — the 3D SIM ruby must ALSO be past the stock, not clamped.
    const threeD = await page.evaluate(() => {
        const mgr = window.ddcsStudio.wizardManager;
        const viz = mgr && mgr._activePanel && mgr._activePanel.viz;
        if (!viz) return null;
        const starts = viz.starts || [];
        const m0 = (viz.spindleMarkers && viz.spindleMarkers[0]) || null;
        return { startX: starts[0] ? starts[0].x : null, markerMeshX: (m0 && m0.position) ? m0.position.x : null, stockX: ((window.ddcsGetSettings() || {}).stock || {}).x };
    });

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/alignment_exit_repro.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    console.log('3D SIM: ' + JSON.stringify(threeD));
    console.log('DURING drag: ' + JSON.stringify(during) + ' ax=' + axDuring);
    console.log('AFTER up: ' + JSON.stringify(after) + ' | param ax=' + rec);

    // t2567 — the marker is no longer kept inside the container while dragging (the removed auto-pan's own
    // job); it IS still screen-pinned at the viewport's own edge (`hCx` clamped to the mouse's own clamped
    // target, not stranded at some arbitrary frozen position) and still genuinely PAST the stock, which is the
    // property that actually matters (the human's own original complaint was "stuck AT THE STOCK EDGE", not
    // "stuck at the container edge" — this test's own title).
    expect(during && during.hVisibleInCanvas === false, 'DURING a drag this far, the marker legitimately leaves the CONTAINER now (t2567, an owner-approved trade — see header) — it is not a bug if this is false').toBe(true);
    expect(during && during.hCx > during.stockRight, 'DURING the drag the marker is PAST the stock right edge on-screen').toBe(true);
    expect(Number(axDuring), 'the handle moved FAR past the stock (fraction ≫ 1) — the pan followed it out, not stuck at the perimeter').toBeGreaterThan(2);
    expect(after && after.outside, 'AFTER the drag the VISIBLE marker sits OUTSIDE the drawn stock rect (2D layout)').toBe(true);
    // the 3D SIM surface: the ruby marker's world X must be past the stock too (not clamped within the stock in 3D)
    expect(threeD && Number(threeD.startX) > Number(threeD.stockX), `the 3D sim ruby is PAST the stock (startX ${threeD && threeD.startX} > stock ${threeD && threeD.stockX})`).toBe(true);
    if (threeD && threeD.markerMeshX != null) expect(Number(threeD.markerMeshX) > Number(threeD.stockX), 'the 3D ruby MESH sits past the stock edge (not render-clamped)').toBe(true);
});
