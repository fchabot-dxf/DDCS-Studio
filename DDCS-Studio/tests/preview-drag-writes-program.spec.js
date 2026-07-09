import { test, expect } from '@playwright/test';

/**
 * PREVIEW DRAGS WRITE THE PROGRAM (t592). Dragging a marker in the BLACK preview panel (the 3D gizmo OR the 2D top view)
 * used to write only the sim-only userStarts — the OP PARAMS never heard it, so a declared op's preview markers disagreed
 * with the Layout handle (which DOES write params). FIX: for an op that DECLARES simStartParams, a preview-panel marker drag
 * routes through THE SAME writer the Layout uses (writeSimStartFrac) → the bound params + emit + every surface follow.
 * Ops WITHOUT simStartParams keep the sim-only behavior. Verified: two surfaces (2D real pointer drag + the 3D onStartChange
 * seam) × two ops (alignment declared / a non-declared op), numeric on the EMIT (a sim-only drag leaves the emit unchanged).
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function openOp(page, op) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 150, y: 100, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate((op) => window.openWiz(op), op);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
}

const snap = (page) => page.evaluate(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    const ps = p.getPassStarts();
    const span = (() => { const f = document.querySelector('#wiz_user_form [data-param="span"]'); return f ? f.value : null; })();
    return { A: ps[0] ? { x: ps[0].x, y: ps[0].y } : null, B: ps[1] ? { x: ps[1].x, y: ps[1].y } : null, span, code: document.getElementById('wiz_user_code').textContent };
});

// A REAL pointer drag on the preview panel's 2D top-view handle for a given pass, by a WORLD delta (mapped via the exposed transform).
async function drag2dHandle(page, pass, dwx, dwy) {
    await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; p.setView('2d'); });
    await page.waitForTimeout(250);
    const geom = await page.evaluate((pass) => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        const cv = p.el.querySelector('.pp-2d');
        const r = cv.getBoundingClientRect();
        const v = cv.__t2view;   // sx = ox + x*scale, sy = oy - y*scale (world→canvas)
        const s = p.getPassStarts()[pass];
        return { rx: r.x, ry: r.y, ox: v.ox, oy: v.oy, scale: v.scale, wx: s.x, wy: s.y };
    }, pass);
    const sx = geom.rx + geom.ox + geom.wx * geom.scale, sy = geom.ry + geom.oy - geom.wy * geom.scale;
    const tx = geom.rx + geom.ox + (geom.wx + dwx) * geom.scale, ty = geom.ry + geom.oy - (geom.wy + dwy) * geom.scale;
    await page.mouse.move(sx, sy); await page.mouse.down();
    await page.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps: 4 }); await page.mouse.move(tx, ty, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(350);
}

test('ALIGNMENT (declared): a 2D preview-handle drag of A writes the program (emit span follows; B holds — independent)', async ({ page }) => {
    await openOp(page, 'user_alignment_data');
    const before = await snap(page);
    await drag2dHandle(page, 0, 40, 0);   // drag A +40mm along the fence (X)
    const after = await snap(page);
    // the EMIT changed — the preview drag wrote the PROGRAM (a sim-only drag would leave the emit byte-identical)
    expect(after.code, 'the emit changed → the preview drag wrote the program (not sim-only)').not.toBe(before.code);
    // marker A moved ~+40 in X; B HELD its absolute position (handle independence → the span field recomputed)
    expect(after.A.x - before.A.x, 'marker A moved along the fence').toBeGreaterThan(20);
    expect(Math.abs(after.B.x - before.B.x), 'B HELD its absolute position (independent of A)').toBeLessThan(3);
    expect(after.span, 'the span field recomputed to hold B (a REAL param write)').not.toBe(before.span);
});

test('ALIGNMENT (declared): the 3D onStartChange seam also writes the program (emit follows)', async ({ page }) => {
    await openOp(page, 'user_alignment_data');
    const before = await snap(page);
    // the EXACT callback the 3D gizmo fires on release: move marker A, keep B
    await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        const ps = p.getPassStarts();
        p.viz.onStartChange([{ x: ps[0].x + 35, y: ps[0].y, z: ps[0].z }, { x: ps[1].x, y: ps[1].y, z: ps[1].z }]);
    });
    await page.waitForTimeout(350);
    const after = await snap(page);
    expect(after.code, 'the 3D-gizmo drag path wrote the program too').not.toBe(before.code);
    expect(after.span, 'the span recomputed (B held) — the same declared writer as 2D + the Layout').not.toBe(before.span);
});

test('NON-declared op: a preview-panel start drag stays SIM-ONLY (the emit is untouched)', async ({ page }) => {
    // a mill/probe op without simStartParams — its operator start is legitimately sim-only.
    await openOp(page, 'user_corner_data');
    const before = await snap(page);
    await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        const s = p.getPassStarts()[0] || { x: 0, y: 0, z: 0 };
        p.onStartDrag({ x: s.x + 25, y: s.y + 15, z: s.z }, 0);   // the real 2D-handle seam
    });
    await page.waitForTimeout(300);
    const after = await snap(page);
    expect(after.code, 'a non-declared op keeps sim-only start behavior — the emit is UNCHANGED').toBe(before.code);
});
