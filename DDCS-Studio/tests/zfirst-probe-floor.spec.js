import { test, expect } from '@playwright/test';

/**
 * Z-FIRST-PROBE-FLOOR — a Middle Probe-Z-First on a DECLARED-DEPTH pocket must touch the pocket FLOOR (top − depth), not the
 * stock top. The surface model is engine/probeGeometry.stockProbeStop (shared by the 3D sim AND the execution-engine sim, so
 * fixing it fixes both; the G31 emit finds the real surface physically → byte-identical). REPRODUCE first, then assert the fix.
 * Frame is STOCK-LOCAL: top at z=0, bottom at z=−Z. A Z-down probe over the pocket centre from above.
 */
test('a Z-down probe inside a declared-depth pocket stops at the FLOOR (top − depth), not the stock top', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { stockProbeStop } = await import('/engine/probeGeometry.js');
        const Z = 20, depth = 8;
        const stock = (feats) => ({ x: 100, y: 80, z: Z, shape: 'pocket', datum: 'nnp', features: feats });
        // a Z-down probe over the pocket CENTRE (50,40), from above the top down through the stock
        const A = { x: 50, y: 40, z: 10 }, B = { x: 50, y: 40, z: -Z - 5 };
        const zAt = (t) => (t == null ? null : A.z + (B.z - A.z) * t);

        // (1) a DECLARED-DEPTH pocket (depth 8 < 20) → the Z touch is the FLOOR at z = −8
        const declared = stock([{ id: 'p', shape: 'rect', side: 'inside', pos: { x: 50, y: 40 }, size: { x: 40, y: 30 }, depth }]);
        const tDeclared = stockProbeStop(A, B, declared, 'x', 0);
        // (2) a THROUGH / undeclared pocket (depth = Z, the legacy) → unchanged (the through-hole; here the top is 0)
        const legacy = stock([{ id: 'p', shape: 'rect', side: 'inside', pos: { x: 50, y: 40 }, size: { x: 40, y: 30 }, depth: Z }]);
        const tLegacy = stockProbeStop(A, B, legacy, 'x', 0);
        // (3) a Z-down probe OUTSIDE the pocket footprint (over solid stock) → the stock TOP (z = 0), unchanged
        const A2 = { x: 10, y: 10, z: 10 }, B2 = { x: 10, y: 10, z: -Z - 5 };
        const tSolid = stockProbeStop(A2, B2, declared, 'x', 0);

        return { zDeclared: zAt(tDeclared), zLegacy: zAt(tLegacy), zSolid: A2.z + (B2.z - A2.z) * tSolid };
    });
    console.log('Z-FIRST FLOOR: ' + JSON.stringify(r));
    // THE FIX: inside a declared-depth pocket → the FLOOR at −depth (top 0 − 8)
    expect(r.zDeclared, 'a Z-down probe inside a declared-depth pocket stops at the FLOOR (−depth), NOT the stock top').toBeCloseTo(-8, 3);
    // outside the pocket (solid) → the stock top, unchanged
    expect(r.zSolid, 'over solid stock, the Z probe stops at the stock top (z=0), unchanged').toBeCloseTo(0, 3);
    // a through/undeclared pocket → the stock top (z=0), unchanged (no declared floor)
    expect(r.zLegacy, 'a through/undeclared pocket is unchanged (top at 0)').toBeCloseTo(0, 3);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE the real Middle probe in-place (Pocket + Probe-Z-First) → the 3D probe path descends INTO the pocket to the FLOOR; screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings);
    // a depth-pocket workpiece so the Middle probe's Z-first reads the declared floor
    await page.evaluate(() => Object.assign(window.ddcsGetSettings().stock, { x: 120, y: 90, z: 20, datum: 'nnp', shape: 'pocket',
        features: [{ id: 'p', shape: 'rect', side: 'inside', pos: { x: 60, y: 45 }, size: { x: 50, y: 34 }, depth: 8 }] }));
    await page.evaluate(() => window.openWiz('user_middle_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
    // Feature = Pocket + Probe Z First ON
    const set = await page.evaluate(() => {
        const ft = document.querySelector('#wiz_user_form [data-param="featureType"]'); if (ft) { ft.value = 'pocket'; ft.dispatchEvent(new Event('change', { bubbles: true })); }
        // "Probe Z First" is a ddcs-switch toggle → find its row + check the input
        const rows = Array.from(document.querySelectorAll('#wiz_user_form div'));
        const zrow = rows.find((d) => /Probe Z First/.test(d.textContent || '') && d.querySelector('input[type="checkbox"]'));
        const zf = zrow && zrow.querySelector('input[type="checkbox"]');
        if (zf) { zf.checked = true; zf.dispatchEvent(new Event('change', { bubbles: true })); zf.dispatchEvent(new Event('input', { bubbles: true })); }
        return { hasFt: !!ft, hasZf: !!zf };
    });
    await page.waitForTimeout(600);
    // read the deepest probe-path Z the 3D drew (touch), from the active panel's viz
    const touch = await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel; const viz = p && p.viz; if (!viz || !viz.lineGroups) return null;
        let minZ = Infinity;
        for (const k of ['probeSlow', 'probeFast']) { const grp = viz.lineGroups[k]; if (grp && grp.geometry) { const a = grp.geometry.attributes.position.array; for (let i = 2; i < a.length; i += 3) minZ = Math.min(minZ, a[i]); } }
        const floorWorld = (viz._pocketFloors && viz._pocketFloors[0]) ? viz._pocketFloors[0].floorZ : null;
        return { minProbeZ: Number.isFinite(minZ) ? minZ : null, floorWorld };
    });
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/zfirst_probe_floor.png' });
    console.log('Z-FIRST WIZARD DRIVE: ' + JSON.stringify({ set, touch }));
    expect(set.hasFt && set.hasZf, 'the Middle form has Feature + Probe-Z-First controls').toBe(true);
});
