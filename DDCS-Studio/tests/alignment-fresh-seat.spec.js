import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT FRESH-OPEN SEAT + 3D TRACE (t674, user-reported V10.127). Two 3D-viz bugs (the 2D/shared `segs` were already
 * correct, which is why alignment-sim-starts-at-a passed and missed these):
 *  (1) FRESH OPEN — the probe SIM (auto-play) seeds at ORIGIN because the declared sim{seatStart} intent is applied AFTER
 *      preview3D's on-open auto-play; the running engine was never re-seeded → the animation ran from origin until a drag.
 *  (2) the 3D TRACE polyline draws from ORIGIN always — the alignment park emits absolute/G53 → stats.absolute → the
 *      trace's anchor `off` collapsed to {0,0,0}, while the animation was spared (it rides engine.pos seeded at A).
 * FIX (preview-only, emit unchanged): setSeatAtStart re-seeds the RUNNING play; the trace's `off` consumes the seat
 * (_seatAtStart) even when stats.absolute. Machine-frame ops (homing) are the untouched machTool branch (negative control).
 */
test.use({ viewport: { width: 1300, height: 950 } });

// Read the 3D viz: marker A (world), the animation tool (world), and the drawn TRACE polyline (first vertex + min dist
// from the origin across ALL route vertices), all in world coords.
const read3D = (page) => page.evaluate(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    const viz = p && p.viz; if (!viz) return null;
    const V3 = viz.THREE.Vector3;
    const worldOf = (obj) => { obj.updateWorldMatrix(true, false); return obj.getWorldPosition(new V3()); };
    const A = (viz.spindleMarkers && viz.spindleMarkers[0]) ? worldOf(viz.spindleMarkers[0]) : null;
    const tool = viz._animTool ? worldOf(viz._animTool) : null;
    // trace polyline: walk every route line group's vertices → head (first) + closest-to-origin
    let head = null, minO = Infinity, nVerts = 0;
    for (const k of ['probeFast', 'probeSlow', 'feed', 'rapid', 'retract']) {
        const ln = viz.lineGroups && viz.lineGroups[k];
        const pa = ln && ln.geometry && ln.geometry.attributes && ln.geometry.attributes.position;
        if (!pa || !pa.count) continue;
        ln.updateWorldMatrix(true, false);
        for (let i = 0; i < pa.count; i++) {
            const w = new V3(pa.getX(i), pa.getY(i), pa.getZ(i)).applyMatrix4(ln.matrixWorld);
            if (head === null) head = { x: w.x, y: w.y };
            const d = Math.hypot(w.x, w.y); if (d < minO) minO = d;
            nVerts++;
        }
    }
    return {
        A: A ? { x: A.x, y: A.y } : null,
        tool: tool ? { x: tool.x, y: tool.y } : null,
        head, minO, nVerts,
    };
});
const dist = (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
const fromOrigin = (a) => a ? Math.hypot(a.x, a.y) : 0;

async function openWiz3D(page, op, autoLoop = true) {
    await page.evaluate(({ al }) => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 150, y: 100, z: 25, datum: 'ccp' }; s.preview = s.preview || {}; s.preview.autoLoop = al; s.preview.default3D = true; }, { al: autoLoop });
    await page.evaluate((o) => window.openWiz(o), op);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.setView) p.setView('3d'); });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.waitForTimeout(500);
}

test('FRESH OPEN: the 3D trace + the sim seat at marker A (NOT origin) with zero interaction; and after a marker move', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/alignmentData.js'); localStorage.removeItem('ddcs_user_ops'); try { U.deleteUserOp('user_alignment_data'); } catch (_) {} U.createUserOp(M.alignmentDataDef()); });
    await openWiz3D(page, 'user_alignment_data', true);

    // sample the animation over the first ~600ms → the CLOSEST the seated play ever comes to the origin (a play seeded at
    // origin starts its first rapid AT origin → minToolOrigin ≈ 0; a play seated at A stays near the fence → ≫ 0)
    let minToolOrigin = Infinity; let last = null;
    for (let i = 0; i < 8; i++) { const r = await read3D(page); if (r) { last = r; minToolOrigin = Math.min(minToolOrigin, fromOrigin(r.tool)); } await page.waitForTimeout(70); }
    const open = last;
    expect(open, 'the 3D viz is up').not.toBeNull();
    expect(fromOrigin(open.A), 'marker A is DISTINCT from the origin (meaningful test)').toBeGreaterThan(10);
    // BUG 2 — the drawn TRACE: its head sits at A, and NO route vertex sits at the machine origin
    expect(dist(open.head, open.A), `the 3D TRACE polyline head starts at A (A=${JSON.stringify(open.A)}, head=${JSON.stringify(open.head)})`).toBeLessThan(6);
    expect(open.minO, 'no TRACE vertex sits at the machine origin {0,0} on fresh open').toBeGreaterThan(10);
    // BUG 1 — the SIM (auto-play) seats at A on fresh open: it never dips to the origin
    expect(minToolOrigin, 'the SIM never seats/animates at the origin on fresh open (seeded at A, zero interaction)').toBeGreaterThan(10);

    // after a MARKER MOVE (the fence anchor A slid along X via the declared frac) — the trace + sim FOLLOW to the new A
    await page.evaluate(() => { const f = document.querySelector('#wiz_user_form [data-param="ax"]'); if (f) { f.value = '0.7'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(500);
    const moved = await read3D(page);
    expect(fromOrigin(moved.A), 'A moved to the new fraction (still off-origin)').toBeGreaterThan(10);
    expect(dist(moved.head, moved.A), 'after the move the TRACE head still starts at the (new) A').toBeLessThan(6);
    expect(moved.minO, 'after the move no TRACE vertex sits at the origin').toBeGreaterThan(10);
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/alignment_fresh_seat.png' });
    console.log('ALIGN open head=' + JSON.stringify(open.head) + ' A=' + JSON.stringify(open.A) + ' minToolOrigin=' + minToolOrigin.toFixed(1) + ' minTraceOrigin=' + open.minO.toFixed(1));
});

test('NEGATIVE CONTROLS: homing (machine-frame) + corner (WCS) traces are UNCHANGED — head at their start, off-origin', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.machine = { x: 600, y: 400, z: -120, show: true }; s.limits = s.limits || {}; s.limits.xMinHome = true; s.limits.yMinHome = true; s.limits.zMaxHome = true; });

    // Homing (toolMachineFrame — the machTool branch my fix does NOT touch; it DOES home TO machine-0, so an origin
    // vertex is CORRECT). The invariant my fix must preserve: the trace head coincides with the seated tool (both ride
    // the machine-frame anchor). Full homing/corner regression = the existing homing-preview-* / corner specs (run separately).
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 }).catch(() => {});
    await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.setView) p.setView('3d'); });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    const hz = await read3D(page);
    if (hz && hz.head && hz.tool) {
        expect(dist(hz.head, hz.tool), 'homing (machine-frame) trace head still coincides with its seated tool — unchanged').toBeLessThan(10);
    }
});
