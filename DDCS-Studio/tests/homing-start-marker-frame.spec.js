import { test, expect } from '@playwright/test';

/**
 * HOMING START-MARKER FRAME (t652, user-reported t647). A homing op is toolMachineFrame — its Start marker is ALREADY in
 * MACHINE coordinates. The toolpath/tool already ignore the part-frame WCS shift, but the START MARKER did not: the 2D/3D
 * previews ADD the work-origin offset to it (double-shift), so with a non-zero WCS (G54 Y-500 on a 756/-776 machine) the
 * marker lands OUTSIDE the envelope. The LAYOUT reads the frame correctly. Fix ONCE at the sceneFrame seam: gate the
 * start-marker transform on toolMachineFrame like the toolpath. ACCEPTANCE: all THREE canvases place Start at the SAME
 * machine point, inside the envelope; a WORK-frame op (corner) keeps its correct WCS-shifted marker (negative control).
 */
test.use({ viewport: { width: 1300, height: 950 } });

// the user's config shape: a 756 × -776 machine with a NON-ZERO active WCS (G54 Y = -500).
async function openHoming(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 756, y: -776, z: -120, show: true, workOrigin: { x: 0, y: -500, z: 0 }, wcs: { active: 1, table: [{ x: 0, y: -500, z: 0 }, {}, {}, {}, {}, {}] } };
        s.homing = { axes: { z: { enable: true, order: 1, method: 'native' }, x: { enable: true, order: 2, method: 'native' }, y: { enable: true, order: 3, method: 'native' } } };
        s.stock = { show: false };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    });
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
}

test('the 3D start marker renders at its MACHINE coordinate (no WCS double-shift) and sits inside the envelope', async ({ page }) => {
    await openHoming(page);
    const r = await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        const viz = p.viz;
        viz.spindleMarkers[0].updateWorldMatrix(true, false);
        const w = viz.spindleMarkers[0].getWorldPosition(new (viz.THREE.Vector3)());
        return { startY: viz.starts[0].y, worldY: +w.y.toFixed(2), shiftY: viz.partFrame.shift.y, machY: window.ddcsGetSettings().machine.y };
    });
    // MACHINE-FRAME INVARIANT: the marker's WORLD Y == the declared machine-coord Start Y (machine home = scene 0), NOT
    // start + workOrigin. With G54 Y=-500 the double-shift used to push it 500 below the declared Start.
    expect(r.worldY, `3D marker world Y (${r.worldY}) == the machine-coord Start Y (${r.startY}) — no WCS double-shift`).toBeCloseTo(r.startY, 1);
    // and it stays INSIDE the envelope [machine.y, 0] = [-776, 0]
    expect(r.worldY <= 0 && r.worldY >= r.machY, `marker world Y (${r.worldY}) inside the envelope [${r.machY}, 0]`).toBe(true);
    { const _b = await page.locator('#wiz_homing').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing-start-marker.png', clip: _b }); }   // t710 clip capture (rAF-starvation dodge)
});

test('2D machine-frame op: the Start marker sits INSIDE the drawn envelope; a work-shifted envelope would exclude it', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { createToolpath2d } = await import('/viz/toolpath2d.js');
        const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400; document.body.appendChild(cv);
        const t2 = createToolpath2d(cv, {});
        t2.setMachine({ x: 756, y: -776, z: -120, show: true, workOrigin: { x: 0, y: -500 }, wcs: { active: 1, table: [{ x: 0, y: -500, z: 0 }] } });
        t2.setStarts([{ x: 378, y: -388, z: -60 }]);   // a machine-coord Start at the envelope mid
        t2.setMachineFrame(true); t2.fit(); t2.redraw();
        const on = { env: cv.__t2env, start: cv.__t2starts[0] };
        t2.setMachineFrame(false); t2.fit(); t2.redraw();   // the pre-fix shape: the machine-coord Start vs a work-shifted (−workOrigin) envelope
        const off = { env: cv.__t2env, start: cv.__t2starts[0] };
        cv.remove();
        return { on, off };
    });
    const inside = (s, e) => !!e && s.y >= e.minY && s.y <= e.maxY && s.x >= e.minX && s.x <= e.maxX;
    // FIX: machine-frame → the envelope is RAW machine coords [−776, 0]; the machine-coord Start (−388) sits INSIDE it.
    expect(inside(r.on.start, r.on.env), `machine-frame: Start Y ${r.on.start.y} inside envelope [${r.on.env.minY},${r.on.env.maxY}]`).toBe(true);
    // the pre-fix shape (envelope shifted by −workOrigin → [−276, 500]) pushed the same machine-coord Start OUTSIDE — the bug.
    expect(inside(r.off.start, r.off.env), `work-shifted envelope [${r.off.env.minY},${r.off.env.maxY}] excludes the machine-coord Start ${r.off.start.y}`).toBe(false);
});
