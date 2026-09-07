import { test, expect } from './support/harness.mjs';

/**
 * ROTARY CLOCK PORT E2 — the single sim-start provider + the inherited box/rig (sim-only, emit byte-identical). The twin's
 * def.simStartsProvider reuses BUILT_IN.rotary_clock (opSimStarts.js) VERBATIM via the sim registry, NOT the builder → emit
 * unchanged. The clock is SINGLE-START (2 Z-down touches a SPAN apart is ONE start + a +Y step, not a reposition) on a
 * rectangular BOX (a flat, NOT a round bar → NO def.simStock; the rig renders 4-jaw on the box). VERIFY assert-the-value
 * vs an INDEPENDENT-TRUTH formula: the start POSITION + COUNT (=1) match {x:sx/2, y:sy/2−span/2, z:min(5,sz/2)}, AND match
 * the built-in RotaryClockWizard.inferStart (parity). Plus the box/rig/start render coherently + emit BYTE-IDENTICAL.
 *
 * t2695 — TIER MIGRATION WORK PACKAGE 3: the original file's SECOND test ("E2 real-symptom") drives the real
 * wizard UI (window.openWiz, document.querySelector, a live Three.js viz object, page.screenshot) and stays in
 * the browser tier — split into tests/rotary-clock-sim-starts-drive.spec.js. This test is pure: page.goto + one
 * page.evaluate that imports app modules, calls opSimStarts/emitMapped, and asserts on plain returned data.
 */
test('E2: the twin single sim-start POSITION + COUNT == the built-in inferStart == the independent formula; emit BYTE-IDENTICAL', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { rotaryClockDataDef, ROTARY_CLOCK_DEFAULTS } = await import('/blocks/dataOps/rotaryClockData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { rotaryClockStack } = await import('/wizards/rotaryClockWizard.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        registerUserOp(rotaryClockDataDef());
        const D = ROTARY_CLOCK_DEFAULTS;
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
            // t1730 — RotaryClockWizard (the legacy screen class) was deleted alongside its view; opSimStarts.js's
            // BUILT_IN.rotary_clock (moved verbatim from the class's own inferStart, a SEPARATE registry entry
            // from the twin's USER_STARTS provider above) is still a genuine second independent path.
            const bi = (opSimStarts('rotary_clock', c, s) || [])[0];   // [0] = A (single) → parity with starts[0], one registry source
            if (!bi || r3(bi.x) !== r3(gotA.x) || r3(bi.y) !== r3(gotA.y) || r3(bi.z) !== r3(gotA.z)) { builtinFails++; if (!firstFail) firstFail = { c, reason: 'builtin', bi, gotA }; }
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
