import { test, expect } from '@playwright/test';

/**
 * ROTARY CENTRELINE PORT E2 — the per-pass sim-starts provider (sim-only, emit byte-identical). The twin's
 * def.simStartsProvider reuses BUILT_IN.rotary_center (opSimStarts.js:86) VERBATIM via the sim registry
 * (registerUserOp → setUserSimStarts), NOT the builder → emit unchanged. VERIFY (assert-the-value vs BUILT_IN):
 * opSimStarts(user_rotary_center_data, c, stock) POSITIONS == opSimStarts(rotary_center, c, stock) across
 * method × approach × scalar combos (0 pos fails); the pass COUNT mirrors the built-in probe passes (known=1, fit=3).
 */
test('E2: the twin sim-starts POSITIONS + COUNT == BUILT_IN.rotary_center across combos; emit BYTE-IDENTICAL', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { rotaryCenterDataDef, ROTARY_CENTER_DEFAULTS } = await import('/blocks/dataOps/rotaryCenterData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        registerUserOp(rotaryCenterDataDef());
        const D = ROTARY_CENTER_DEFAULTS;
        const stock = { x: 150, y: 76.2, z: 76.2, shape: 'cylinder' };
        const combos = [
            { ...D },                                              // known / auto
            { ...D, approach: 'guided' },                          // known / guided
            { ...D, method: 'fit' },                               // fit (3 passes)
            { ...D, method: 'fit', retract: 4, radius: 3, safeZ: 20 },   // fit + scalars (flank geometry moves)
            { ...D, retract: 5, radius: 1 },                       // known + scalars (single top pass)
        ];
        const r3 = (v) => Math.round(v * 1000) / 1000;
        let posFails = 0, firstFail = null;
        const counts = [];
        for (const c of combos) {
            const twin = opSimStarts('user_rotary_center_data', c, stock) || [];
            const builtin = opSimStarts('rotary_center', c, stock) || [];
            counts.push({ method: c.method || 'known', twinN: twin.length, builtinN: builtin.length });
            if (twin.length !== builtin.length) { posFails++; if (!firstFail) firstFail = { c, reason: 'count', twinN: twin.length, builtinN: builtin.length }; continue; }
            for (let i = 0; i < twin.length; i++) {
                if (r3(twin[i].x) !== r3(builtin[i].x) || r3(twin[i].y) !== r3(builtin[i].y) || r3(twin[i].z) !== r3(builtin[i].z)) {
                    posFails++; if (!firstFail) firstFail = { c, reason: 'pos', i, twin: twin[i], builtin: builtin[i] }; break;
                }
            }
        }
        // emit BYTE-IDENTICAL — the provider is sim-only, the builder is untouched
        const emitSame = emitMapped(builderOf('user_rotary_center_data')({ ...D })).text === emitMapped(rotaryCenterStack({ ...D })).text
            && emitMapped(builderOf('user_rotary_center_data')({ ...D, method: 'fit' })).text === emitMapped(rotaryCenterStack({ ...D, method: 'fit' })).text;
        return { posFails, firstFail, counts, emitSame, knownN: counts.find((x) => x.method === 'known').twinN, fitN: counts.find((x) => x.method === 'fit').twinN };
    });
    if (r.firstFail) console.log('E2 SIM-START FAIL: ' + JSON.stringify(r.firstFail));
    expect(r.posFails, 'the twin sim-start POSITIONS + COUNT == BUILT_IN.rotary_center across all combos (0 fails)').toBe(0);
    expect(r.knownN, 'KNOWN method = 1 pass (probe the top)').toBe(1);
    expect(r.fitN, 'FIT method = 3 passes (top + 2 flanks, the 3-point circle solve)').toBe(3);
    expect(r.emitSame, 'emit BYTE-IDENTICAL (the provider is sim-only, via the registry not the builder)').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E2 real-symptom: the twin renders its multi-pass markers on the preview (fit → 3 starts)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 150, y: 76.2, z: 76.2, shape: 'cylinder', show: true } }); });
    // NOT seeded yet (E2) → PERSIST it (createUserOp) so openWiz routes to its userOpView
    await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/rotaryCenterData.js'); localStorage.removeItem('ddcs_user_ops'); try { U.deleteUserOp('user_rotary_center_data'); } catch (_) {} U.createUserOp(M.rotaryCenterDataDef()); });
    await page.evaluate(() => window.openWiz('user_rotary_center_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    // switch to the FIT method → 3 passes
    await page.evaluate(() => { const s = document.querySelector('#wiz_user_form [data-param="method"]'); if (s) { s.value = 'fit'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.waitForTimeout(700);
    const r = await page.evaluate(async () => {
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { ROTARY_CENTER_DEFAULTS } = await import('/blocks/dataOps/rotaryCenterData.js');
        const starts = opSimStarts('user_rotary_center_data', { ...ROTARY_CENTER_DEFAULTS, method: 'fit' }, (window.ddcsGetSettings() || {}).stock) || [];
        const canvas = document.querySelector('#wiz_user canvas');
        const methodVal = (document.querySelector('#wiz_user_form [data-param="method"]') || {}).value;
        return { nStarts: starts.length, hasViz: !!canvas, methodVal };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/rotary_center_simstarts.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(r.methodVal, 'the form is on the FIT method').toBe('fit');
    expect(r.nStarts, 'FIT declares 3 per-pass starts (the 3-point circle solve)').toBe(3);
    expect(r.hasViz, 'the rotary machine-frame preview renders').toBe(true);
});
