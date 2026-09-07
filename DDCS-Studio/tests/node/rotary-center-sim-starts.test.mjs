import { test, expect } from './support/harness.mjs';

/**
 * ROTARY CENTRELINE PORT E2 — the per-pass sim-starts provider (sim-only, emit byte-identical). The twin's
 * def.simStartsProvider reuses BUILT_IN.rotary_center (opSimStarts.js:86) VERBATIM via the sim registry
 * (registerUserOp → setUserSimStarts), NOT the builder → emit unchanged. VERIFY (assert-the-value vs BUILT_IN):
 * opSimStarts(user_rotary_center_data, c, stock) POSITIONS == opSimStarts(rotary_center, c, stock) across
 * method × approach × scalar combos (0 pos fails); the pass COUNT mirrors the built-in probe passes (known=1, fit=3).
 *
 * t2695 — TIER MIGRATION WORK PACKAGE 3: the original file's SECOND test ("E2 real-symptom") drives the real
 * wizard UI (window.openWiz, document.querySelector, page.screenshot, a live Three.js viz object) and stays in
 * the browser tier — split into tests/rotary-center-sim-starts-drive.spec.js. This test is pure: page.goto +
 * one page.evaluate that imports app modules, calls opSimStarts/emitMapped, and asserts on plain returned data.
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
