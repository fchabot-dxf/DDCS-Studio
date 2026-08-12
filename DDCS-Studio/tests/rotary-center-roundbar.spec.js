import { test, expect } from '@playwright/test';

/**
 * ROTARY CENTRELINE PORT E3 — the round-bar sim read (retire activateCylinderStock for the TWIN path; SIM-ONLY, emit
 * byte-identical). F3 pre-ruled: the #57 diameter knob is the bar-Ø control; the twin's def.simStock DERIVES a round bar
 * from #57 WITHOUT mutating the global settings.stock. Registered via setUserSimStock → userOpView feeds it to the preview.
 * VERIFY: the derived bar (cylinder, Ø from #57) · NO global stock.shape mutation on the twin open (the hack is gone) ·
 * emit BYTE-IDENTICAL (sim-only) · restoreBoxStock (the defensive edge/middle/clock revert) still works.
 */
const OPTYPE = 'user_rotary_center_data';

test('E3 unit: def.simStock derives a round bar from #57 (cylinder, Ø, along the rotary axis); emit byte-identical', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
    const r = await page.evaluate(async (OPTYPE) => {
        const { rotaryCenterDataDef, ROTARY_CENTER_DEFAULTS } = await import('/blocks/dataOps/rotaryCenterData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { getUserSimStock, opSimStarts } = await import('/viz/opSimStarts.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
        const SP = await import('/ui/settingsPanel.js');
        SP.applySettings({ stock: { x: 200, y: 100, z: 100, shape: 'box', show: true } });   // a BOX stock (NOT a cylinder)
        registerUserOp(rotaryCenterDataDef());
        const fn = getUserSimStock(OPTYPE);
        const bar = fn ? fn({ ...ROTARY_CENTER_DEFAULTS, diameter: 50 }, window.ddcsGetSettings().stock) : null;
        // the GLOBAL stock is UNMUTATED (deriving the bar does NOT applySettings — the activateCylinderStock hack is gone for the twin)
        const g = window.ddcsGetSettings().stock;
        // the FIT flank starts use the DERIVED bar's radius (Ø/2 = 25), not the box → the flank offset reflects the bar
        const barR = await import('/engine/probeGeometry.js').then((m) => m.barRadius(bar, bar.y, bar.z));
        // emit BYTE-IDENTICAL (sim-only — the builder is untouched)
        const emitSame = emitMapped(builderOf(OPTYPE)({ ...ROTARY_CENTER_DEFAULTS })).text === emitMapped(rotaryCenterStack({ ...ROTARY_CENTER_DEFAULTS })).text
            && emitMapped(builderOf(OPTYPE)({ ...ROTARY_CENTER_DEFAULTS, method: 'fit', diameter: 50 })).text === emitMapped(rotaryCenterStack({ ...ROTARY_CENTER_DEFAULTS, method: 'fit', diameter: 50 })).text;
        return {
            hasFn: !!fn, barShape: bar && bar.shape, barDia: bar && bar.diameter, barY: bar && bar.y, barZ: bar && bar.z, barX: bar && bar.x, barR,
            globalShape: g && g.shape, globalY: g && g.y, emitSame,
        };
    }, OPTYPE);
    expect(r.hasFn, 'the twin registers a per-op sim-stock provider (setUserSimStock)').toBe(true);
    expect(r.barShape, 'the derived preview stock is a cylinder (round bar)').toBe('cylinder');
    expect(r.barDia, 'its Ø comes from #57 (the diameter knob)').toBe(50);
    expect([r.barY, r.barZ], 'the cross-section = the bar Ø (along the X rotary axis)').toEqual([50, 50]);
    expect(r.barX, 'the axial length keeps the stock dim (200)').toBe(200);
    expect(r.barR, 'barRadius = Ø/2 = 25').toBe(25);
    expect(r.globalShape, 'NO global stock.shape mutation — the settings.stock stays a BOX (the activateCylinderStock hack is gone for the twin)').toBe('box');
    expect(r.globalY, 'the global stock cross dim is untouched (100, not squared to the bar)').toBe(100);
    expect(r.emitSame, 'emit BYTE-IDENTICAL (the round-bar read is sim-only)').toBe(true);
});

// t1722 (gate repair, cycle 857 ACT 2) — this test's OWN title named the built-in shim's mutation as "deferred
// dead-code cleanup" — that cleanup landed at t1722 (activateCylinderStock retired, no export survived).
// t1732 port note — REPOINTED, not merely no-longer-passing: t1730 went further and deleted the WHOLE
// rotaryCenterView.js file (its sole remaining reason to exist — restoreBoxStock as a defensive no-op called by
// edge/middle/rotary-clock views' onOpen — vanished the same act those 3 views were deleted too, WORK-LOG t1730).
// So `import('/wizards/views/rotaryCenterView.js')` now throws (404) rather than returning a no-op export — a
// STRONGER, more definitive form of the exact same claim this test always made ("the mutating hack is gone"):
// there is no longer any CODE left that could mutate the global stock, not merely a function that declines to.
test('E3: rotaryCenterView.js (activateCylinderStock + restoreBoxStock) is fully retired — t1730 deleted the whole file, not merely the mutation', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        const SP = await import('/ui/settingsPanel.js');
        SP.applySettings({ stock: { x: 200, y: 100, z: 80, shape: 'box', show: true } });
        const before = window.ddcsGetSettings().stock.shape;
        let importThrew = false;
        try { await import('/wizards/views/rotaryCenterView.js'); } catch (_) { importThrew = true; }
        const after = window.ddcsGetSettings().stock.shape;
        return { importThrew, before, after };
    });
    expect(r.importThrew, 'the whole file is gone (t1730), not just activateCylinderStock retired within it').toBe(true);
    expect(r.before).toBe('box');
    expect(r.after, 'nothing mutated the global stock — there is no code left that could').toBe('box');
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E3 real-symptom: the twin opens on a BOX stock but the sim RENDERS a round bar from #57 (no global mutation)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 100, z: 100, shape: 'box', show: true } }); });
    await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/rotaryCenterData.js'); localStorage.removeItem('ddcs_user_ops'); try { U.deleteUserOp('user_rotary_center_data'); } catch (_) {} U.createUserOp(M.rotaryCenterDataDef()); });
    await page.evaluate(() => window.openWiz('user_rotary_center_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
        const g = window.ddcsGetSettings().stock;
        const canvas = document.querySelector('#wiz_user canvas');
        return { globalShape: g.shape, globalY: g.y, hasViz: !!canvas };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/rotary_center_roundbar.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(r.globalShape, 'opening the twin does NOT mutate the global stock to a cylinder (the hack is gone)').toBe('box');
    expect(r.globalY, 'the global stock cross dim is untouched').toBe(100);
    expect(r.hasViz, 'the 3D preview renders (the round bar from #57)').toBe(true);
});
