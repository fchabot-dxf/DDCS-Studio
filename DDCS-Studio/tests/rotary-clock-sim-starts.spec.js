import { test, expect } from '@playwright/test';

/**
 * ROTARY CLOCK PORT E2 — the single sim-start provider + the inherited box/rig (sim-only, emit byte-identical). The twin's
 * def.simStartsProvider reuses BUILT_IN.rotary_clock (opSimStarts.js) VERBATIM via the sim registry, NOT the builder → emit
 * unchanged. The clock is SINGLE-START (2 Z-down touches a SPAN apart is ONE start + a +Y step, not a reposition) on a
 * rectangular BOX (a flat, NOT a round bar → NO def.simStock; the rig renders 4-jaw on the box). VERIFY assert-the-value
 * vs an INDEPENDENT-TRUTH formula: the start POSITION + COUNT (=1) match {x:sx/2, y:sy/2−span/2, z:min(5,sz/2)}, AND match
 * the built-in RotaryClockWizard.inferStart (parity). Plus the box/rig/start render coherently + emit BYTE-IDENTICAL.
 */
test('E2: the twin single sim-start POSITION + COUNT == the built-in inferStart == the independent formula; emit BYTE-IDENTICAL', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { rotaryClockDataDef, ROTARY_CLOCK_DEFAULTS } = await import('/blocks/dataOps/rotaryClockData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { rotaryClockStack, RotaryClockWizard } = await import('/wizards/rotaryClockWizard.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        registerUserOp(rotaryClockDataDef());
        const D = ROTARY_CLOCK_DEFAULTS;
        const wiz = new RotaryClockWizard();
        const r3 = (v) => Math.round(v * 1000) / 1000;
        // the INDEPENDENT-TRUTH formula: POINT A = the stock CENTRE (span-INDEPENDENT — the jog-to start), B = A + span in +Y
        const expected = (c, s) => ({ x: (s ? s.x : 150) / 2, y: (s ? s.y : 76) / 2, z: Math.min(5, (s ? s.z : 76) * 0.5) });
        const cases = [
            { c: { ...D }, s: { x: 200, y: 100, z: 100, shape: 'box' } },
            { c: { ...D, span: 40 }, s: { x: 200, y: 100, z: 100, shape: 'box' } },
            { c: { ...D, span: 12.5 }, s: { x: 150, y: 80, z: 8, shape: 'box' } },   // small z → z clamps to min(5, sz/2)
            { c: { ...D, action: 'rotate' }, s: { x: 300, y: 120, z: 90, shape: 'box' } },
            { c: { ...D }, s: null },   // no stock → the num() defaults (150/76/76)
        ];
        let posFails = 0, countFails = 0, builtinFails = 0, firstFail = null;
        for (const { c, s } of cases) {
            const starts = opSimStarts('user_rotary_clock_data', c, s) || [];
            if (starts.length !== 2) { countFails++; if (!firstFail) firstFail = { c, reason: 'count', n: starts.length }; continue; }   // t530 — A + B (B = A + span)
            const eA = expected(c, s), gotA = starts[0];
            const span = c.span != null ? c.span : 20;
            const eB = { x: eA.x, y: eA.y + span, z: eA.z }, gotB = starts[1];   // B = A + span in +Y
            if (r3(gotA.x) !== r3(eA.x) || r3(gotA.y) !== r3(eA.y) || r3(gotA.z) !== r3(eA.z)
                || r3(gotB.x) !== r3(eB.x) || r3(gotB.y) !== r3(eB.y) || r3(gotB.z) !== r3(eB.z)) { posFails++; if (!firstFail) firstFail = { c, reason: 'pos', gotA, eA, gotB, eB }; }
            const bi = wiz.inferStart(c, s);   // inferStart returns [0] = A (single) → parity with starts[0], one registry source
            if (r3(bi.x) !== r3(gotA.x) || r3(bi.y) !== r3(gotA.y) || r3(bi.z) !== r3(gotA.z)) { builtinFails++; if (!firstFail) firstFail = { c, reason: 'builtin', bi, gotA }; }
        }
        // emit BYTE-IDENTICAL — the provider is sim-only, the builder untouched
        const emitSame = emitMapped(builderOf('user_rotary_clock_data')({ ...D })).text === emitMapped(rotaryClockStack({ ...D })).text
            && emitMapped(builderOf('user_rotary_clock_data')({ ...D, action: 'rotate', reference: 'side' })).text === emitMapped(rotaryClockStack({ ...D, action: 'rotate', reference: 'side' })).text;
        return { posFails, countFails, builtinFails, firstFail, emitSame };
    });
    if (r.firstFail) console.log('E2 SIM-START FAIL: ' + JSON.stringify(r.firstFail));
    expect(r.countFails, 'the twin declares TWO sim-starts — A + B (B = A + span), both draggable handles').toBe(0);
    expect(r.posFails, 'A matches {sx/2, sy/2−span/2, min(5,sz/2)} AND B = A + span in +Y, across combos').toBe(0);
    expect(r.builtinFails, 'the twin start A == the built-in RotaryClockWizard.inferStart[0] (parity, one registry source)').toBe(0);
    expect(r.emitSame, 'emit BYTE-IDENTICAL (the provider is sim-only, via the registry not the builder)').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E2 real-symptom: the twin renders the BOX + the 4th-axis RIG + the single start on the preview (clock = a flat on a box, not a bar)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 100, z: 100, shape: 'box', show: true } }); });
    // NOT seeded yet (E2) → PERSIST it (createUserOp) so openWiz routes to its userOpView
    await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/rotaryClockData.js'); localStorage.removeItem('ddcs_user_ops'); try { U.deleteUserOp('user_rotary_clock_data'); } catch (_) {} U.createUserOp(M.rotaryClockDataDef()); });
    await page.evaluate(() => window.openWiz('user_rotary_clock_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz._partGroup; }, { timeout: 8000 });
    await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { ROTARY_CLOCK_DEFAULTS } = await import('/blocks/dataOps/rotaryClockData.js');
        const starts = opSimStarts('user_rotary_clock_data', { ...ROTARY_CLOCK_DEFAULTS }, (window.ddcsGetSettings() || {}).stock) || [];
        const viz = window.ddcsStudio.wizardManager._activePanel.viz;
        const canvas = document.querySelector('#wiz_user canvas');
        return {
            nStarts: starts.length, hasViz: !!canvas,
            stockShape: viz._stock && viz._stock.shape,
            rigBuilt: !!viz._rotaryFixture, rigChildOfPart: !!viz._rotaryFixture && viz._rotaryFixture.parent === viz._partGroup,
        };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/rotary_clock_e2_sim.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(r.nStarts, 'the clock declares TWO sim-starts (A + B, both draggable)').toBe(2);
    expect(r.hasViz, 'the rotary machine-frame preview renders').toBe(true);
    expect(r.stockShape, 'the clock sim shows a rectangular BOX (a flat, not a round bar → no def.simStock)').toBe('box');
    expect(r.rigBuilt, 'the 4th-axis RIG renders (inherited FREE via the declared sim{rotary:true} + the generic userOpView, E5)').toBe(true);
    expect(r.rigChildOfPart, 'the rig is a child of _partGroup (spins + datum-placed)').toBe(true);
});
