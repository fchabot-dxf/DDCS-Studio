import { test, expect } from '@playwright/test';

/**
 * t875 — V-CARVE PREVIEW (backlog item 10, Option A). A vee tool's material-removal carve renders with the correct V
 * cross-section (width = 2·depth·tan(halfAngle)) so engraving previews look like engraving. Preview-only (emits untouched).
 * The crisp mesher SHARPENS vertical walls and a v-carve has none → the SMOOTH mesh is the correct settled render for a
 * vee-containing carve; flat-only programs stay on the crisp path. The tool-table gains a vee ANGLE; the sim tool is a cone.
 */
test.use({ viewport: { width: 1300, height: 950 } });

test('the V cross-section width = 2·depth·tan(halfAngle) at 3 depths × 2 angles (captured height field / smooth mesh)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const M = await import('/engine/stockRemoval.js');
        const measure = (angle, depth) => {
            const hm = new M.HeightmapCarve({ x: 40, y: 40, z: 10 }, []);
            hm.carveSegment({ x: 8, y: 20, z: -depth }, { x: 32, y: 20, z: -depth }, 3, 'feed', 'vee', angle);   // a V groove along X at y=20
            const ci = Math.round(20 / hm.dx);
            let jmin = 1e9, jmax = -1e9, floorZ = 0;
            for (let j = 0; j < hm.ny; j++) { const h = hm.h[hm.idx(ci, j)]; if (h < -0.02) { if (j < jmin) jmin = j; if (j > jmax) jmax = j; } }
            floorZ = hm.h[hm.idx(ci, Math.round(20 / hm.dy))];
            return { width: (jmax - jmin) * hm.dy + hm.dy, expect: 2 * depth * Math.tan((angle / 2) * Math.PI / 180), floorZ, cell: hm.dy };
        };
        const out = {};
        for (const a of [60, 90]) for (const d of [1, 2, 3]) out[`a${a}d${d}`] = measure(a, d);
        return out;
    });
    for (const a of [60, 90]) for (const d of [1, 2, 3]) {
        const m = r[`a${a}d${d}`];
        expect(Math.abs(m.width - m.expect), `${a}° depth ${d}: width ${m.width.toFixed(2)} ≈ 2·${d}·tan(${a / 2}°) = ${m.expect.toFixed(2)}`).toBeLessThan(2 * m.cell + 0.05);
        expect(Math.abs(m.floorZ + d), `${a}° depth ${d}: the V floor centre = the tip depth -${d}`).toBeLessThan(0.05);
    }
});

test('FLAT stays a flat floor (unchanged); VEE is a V — the tip profile branches on the tool type', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const M = await import('/engine/stockRemoval.js');
        const floorAt = (tip, angle, dOff) => {
            const hm = new M.HeightmapCarve({ x: 40, y: 40, z: 10 }, []);
            hm.carveSegment({ x: 8, y: 20, z: -2 }, { x: 32, y: 20, z: -2 }, 3, 'feed', tip, angle);
            const ci = Math.round(20 / hm.dx), cj = Math.round(20 / hm.dy);
            return { centre: hm.h[hm.idx(ci, cj)], off: hm.h[hm.idx(ci, cj + dOff)] };   // centre vs a cell offset in Y
        };
        return {
            flat: floorAt('flat', 0, 2),   // a flat endmill: centre and near-centre at the SAME depth (flat floor)
            vee: floorAt('vee', 90, 2),     // a vee: near-centre is SHALLOWER than the centre (V walls)
            tipFlat: M.carveTipForToolType('endmill'), tipVee: M.carveTipForToolType('vbit'), tipBall: M.carveTipForToolType('ballnose'),
        };
    });
    expect(r.tipVee, 'vbit → vee tip').toBe('vee');
    expect(r.tipFlat, 'endmill → flat tip (unchanged)').toBe('flat');
    expect(r.tipBall, 'ballnose → ball tip (unchanged)').toBe('ball');
    expect(Math.abs(r.flat.centre - r.flat.off), 'FLAT: the floor is flat (centre == off)').toBeLessThan(0.02);
    expect(r.vee.off, 'VEE: a cell off-centre is SHALLOWER than the centre (the V wall rises)').toBeGreaterThan(r.vee.centre + 0.1);
});

test('MESH MODE: a vee carve SETTLES on the smooth mesh; a flat carve settles crisp (both asserted)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.THREE, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const { GcodeViz3D } = await import('/viz/gcodeViz3d.js');
        const mk = (tip, angle) => {
            const host = document.createElement('div'); host.style.cssText = 'width:300px;height:200px'; document.body.appendChild(host);
            const v = new GcodeViz3D(host);
            v.setStock({ x: 40, y: 40, z: 10, show: true });
            v.setCarve(true);
            const seg = { x1: 8, y1: 20, z1: -2, x2: 32, y2: 20, z2: -2, type: 'feed' };
            v.carveEndState([seg], 3, tip, angle);
            const mode = v._carveMeshMode;
            host.remove();
            return mode;
        };
        return { vee: mk('vee', 90), flat: mk('flat', 0) };
    });
    expect(r.vee, 'a vee carve settles on the SMOOTH mesh (the V is the correct settled render, not a degrade)').toBe('smooth');
    expect(r.flat, 'a flat carve settles on the CRISP mesh (vertical walls — unchanged)').toBe('crisp');
});

test('the tool table has a vee ANGLE° column (V-bit/chamfer/engraver only); the seed 60° V-Bit stores angle 60', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openSettings, null, { timeout: 15000 });
    const seedAngle = await page.evaluate(async () => {
        const { STANDARD_TOOLS, normalizeTool } = await import('/ui/settingsPanel.js');
        const vbit = STANDARD_TOOLS.find((t) => t.type === 'vbit');
        return { seed: vbit && vbit.angle, normalized: normalizeTool({ type: 'vbit', angle: 30 }).angle, blankKept: 'angle' in normalizeTool({ type: 'endmill' }) };
    });
    expect(seedAngle.seed, 'the seed 60° V-Bit stores angle 60').toBe(60);
    expect(seedAngle.normalized, 'normalizeTool carries the angle').toBe(30);
    expect(seedAngle.blankKept, 'the atom always has an angle key (blank for non-vee)').toBe(true);
    // the Angle° column renders in the tool-library modal, and the V-Bit row shows an editable angle cell
    await page.evaluate(async () => { const { openToolLibrary } = await import('/ui/settingsPanel.js'); openToolLibrary(); });
    await page.waitForSelector('#toollib-modal.active', { timeout: 6000 });
    const ui = await page.evaluate(() => ({
        hasCol: [...document.querySelectorAll('#toollib-modal th')].some((th) => /Angle/.test(th.textContent)),
        veeAngleCell: !!document.querySelector('#toollib-modal input[data-field="angle"]'),
    }));
    expect(ui.hasCol, 'the tool library shows an Angle° column').toBe(true);
    expect(ui.veeAngleCell, 'a vee tool row has an editable angle cell').toBe(true);
});

test('screenshots: the vee sim tool renders a CONE; a text-engraving program previews with the V (the engraving look)', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.THREE, null, { timeout: 15000 });
    // the sim tool cone for a vee tool
    const coneOk = await page.evaluate(async () => {
        const { GcodeViz3D } = await import('/viz/gcodeViz3d.js');
        const { toolHalfProfile } = await import('/viz/toolProfile.js');
        // the vee half-profile is a cone (a rising outer point), not a flat cylinder edge
        const prof = toolHalfProfile({ type: 'vbit', dia: 6, angle: 60 });
        const host = document.createElement('div'); host.className = '__vt'; host.style.cssText = 'position:fixed;left:8px;top:8px;width:360px;height:300px;z-index:99999;background:#0d1117';
        document.body.appendChild(host);
        const v = new GcodeViz3D(host); v.setSimTool({ type: 'vbit', dia: 6, angle: 60 }); if (v.setActive) v.setActive(true); if (v.render) v.render();
        window.__vt = v;
        // a cone silhouette: the tip (min radius) is at the bottom and the radius grows upward
        return { pts: prof.length, isCone: prof.length >= 2 && prof.some((q) => q[0] > 0.1) && prof[0][0] < 0.5 };
    });
    expect(coneOk.isCone, 'the vee tool half-profile is a cone silhouette (tip at 0, widening)').toBe(true);
    await page.locator('.__vt').screenshot({ path: testInfo.outputPath('t875-vee-cone.png') });

    // the text engraving preview with a vee tool
    await page.evaluate(() => { window.__vt && window.__vt.dispose && window.__vt.dispose(); document.querySelectorAll('.__vt').forEach((n) => n.remove()); });
    await page.waitForFunction(() => window.openWiz, null, { timeout: 8000 });
    await page.evaluate(() => window.openWiz('text', null, true));
    await page.waitForSelector('#wiz_text', { state: 'visible', timeout: 8000 }).catch(() => {});
    await page.evaluate(() => {
        const t = document.getElementById('tx_text'); if (t) { t.value = 'VEE'; t.dispatchEvent(new Event('input', { bubbles: true })); }
        const d = document.getElementById('tx_depth'); if (d) { d.value = '2'; d.dispatchEvent(new Event('input', { bubbles: true })); }
        const sel = document.getElementById('tx_tool');
        if (sel) { const vopt = [...sel.options].find((o) => /V-?Bit|vbit/i.test(o.textContent)); if (vopt) { sel.value = vopt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); } }
    });
    await page.waitForTimeout(700);
    const host = page.locator('#wiz_text').first();
    await host.screenshot({ path: testInfo.outputPath('t875-text-engraving.png') });
});
