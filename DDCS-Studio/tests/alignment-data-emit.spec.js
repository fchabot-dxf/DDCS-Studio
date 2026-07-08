import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT PORT E1+E2 — the data-op twin's emit is BYTE-IDENTICAL to the built-in alignmentStack + the (existing) sim-starts.
 * The E0 superset (banked, 9b531e3) guards checkAxis×probeDir (4 arms); the 6 value bindings re-inject the scalars (#19 safeZ
 * bindable via F2); the value-swaps (safeZFrame + the scalar/tolerance header comment — F3 tolerance display-only) are
 * RECOMPOSED in postInstantiate. E2: def.simStartsProvider reuses the EXISTING BUILT_IN.alignment (2 starts A/B). VERIFY:
 * (a) byte-diff ZERO across the 8-combo structural + a scalar sweep, studio AND Expert; (b) sim-starts POSITIONS+COUNT ==
 * BUILT_IN.alignment (2); (c) the sim renders the box + 2 starts (NO rig/simStock). INDEPENDENT TRUTH: the built-in is a separate path.
 */
test('E1 byte-diff ZERO: user_alignment_data == alignmentStack across 8 structural + a scalar sweep (incl safeZ/tolerance), studio AND Expert', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignmentDataDef, ALIGNMENT_DEFAULTS } = await import('/blocks/dataOps/alignmentData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        registerUserOp(alignmentDataDef());   // NOT seeded yet → register for the test
        const build = builderOf('user_alignment_data');
        const D = { ...ALIGNMENT_DEFAULTS, travel: 'manual' };   // t510 — the STRUCTURAL/scalar sweep pins the MANUAL emit (stock-independent, byte-identical to pre-AUTO); AUTO byte-identity = its own test

        const CHECK = ['X', 'Y'], DIR = ['pos', 'neg'], FR = ['relative', 'machine'];
        const structCombos = [];
        for (const checkAxis of CHECK) for (const probeDir of DIR) for (const safeZFrame of FR)
            structCombos.push({ ...D, checkAxis, probeDir, safeZFrame });
        const scalarCombos = [
            { ...D, dist: 40, retract: 3, f_fast: 250, f_slow: 40 },
            { ...D, safeZ: 25, port: 4 },                                  // safeZ → #19 (F2-bindable) + #20=[0-#19] tracks
            { ...D, tolerance: 0.05, checkAxis: 'Y' },                     // F3: tolerance recomposes the header comment only
            { ...D, probeDir: 'neg', dist: 55, safeZ: 8 },
        ];
        const all = [...structCombos, ...scalarCombos];

        const orig = window.ddcsResolveProbeSources;
        let studioDiffs = 0, expertDiffs = 0, firstDiff = null;
        const lineDiff = (twin, builtin, p) => {
            const tl = twin.split('\n'), bl = builtin.split('\n');
            let li = 0; while (li < tl.length && li < bl.length && tl[li] === bl[li]) li++;
            return { p, line: li, twinCtx: tl.slice(Math.max(0, li - 1), li + 2), builtinCtx: bl.slice(Math.max(0, li - 1), li + 2) };
        };
        window.ddcsResolveProbeSources = () => ({});
        for (const p of all) {
            const twin = emitMapped(build(p)).text;
            const builtin = emitMapped(alignmentStack(p)).text;
            if (twin !== builtin) { studioDiffs++; if (!firstDiff) firstDiff = { profile: 'studio', ...lineDiff(twin, builtin, { checkAxis: p.checkAxis, probeDir: p.probeDir, safeZFrame: p.safeZFrame, tolerance: p.tolerance }) }; }
        }
        const REG = { port: '#1078', fastFeed: '#1080', retract: '#1082' };
        window.ddcsResolveProbeSources = () => ({ ...REG });
        for (const p of all) {
            const twin = emitMapped(build(p)).text;
            const builtin = emitMapped(alignmentStack({ ...p, sources: { ...REG } })).text;
            if (twin !== builtin) { expertDiffs++; if (!firstDiff) firstDiff = { profile: 'expert', ...lineDiff(twin, builtin, { checkAxis: p.checkAxis }) }; }
        }
        window.ddcsResolveProbeSources = orig;
        // WIRING — sentinel scalars land in their sockets
        const wireDist = emitMapped(build({ ...D, dist: 99 })).text;
        const wireSafeZ = emitMapped(build({ ...D, safeZ: 99 })).text;
        return {
            structCount: structCombos.length, studioDiffs, expertDiffs, firstDiff,
            wireDist: /^#1=99 \(/m.test(wireDist),
            wireSafeZ: /^#19=99 \(/m.test(wireSafeZ) && /^#20=\[0-#19\] /m.test(wireSafeZ),   // #19 binds, #20 STAYS the ref
        };
    });
    expect(r.structCount, 'the full structural sweep is 2×2×2 = 8 combos').toBe(8);
    if (r.firstDiff) console.log('E1 DIFF [' + r.firstDiff.profile + '] @ ' + JSON.stringify(r.firstDiff.p) + ' line ' + r.firstDiff.line + '\n--TWIN--\n' + (r.firstDiff.twinCtx || []).join('\n') + '\n--BUILTIN--\n' + (r.firstDiff.builtinCtx || []).join('\n'));
    expect(r.studioDiffs, 'STUDIO: byte-diff ZERO across 8 struct + scalar combos (guards pruned, scalars bound, header/tolerance recomposed)').toBe(0);
    expect(r.expertDiffs, 'EXPERT: byte-diff ZERO (source-chips #2/#3/#5 → registers, matching the built-in)').toBe(0);
    expect(r.wireDist, 'WIRING: dist=99 lands in #1').toBe(true);
    expect(r.wireSafeZ, 'WIRING: safeZ=99 lands in #19 and #20 STAYS [0-#19] (F2 — the ref tracks)').toBe(true);
});

test('E2 sim-starts: the twin POSITIONS + COUNT == the EXISTING BUILT_IN.alignment (2 starts A/B); emit BYTE-IDENTICAL', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignmentDataDef, ALIGNMENT_DEFAULTS } = await import('/blocks/dataOps/alignmentData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        registerUserOp(alignmentDataDef());
        const D = ALIGNMENT_DEFAULTS;
        const stock = { x: 150, y: 100, z: 25, shape: 'box' };
        const combos = [{ ...D }, { ...D, checkAxis: 'Y' }, { ...D, span: 30 }];
        const r3 = (v) => Math.round(v * 1000) / 1000;
        let posFails = 0, countFails = 0, firstFail = null;
        for (const c of combos) {
            const twin = opSimStarts('user_alignment_data', c, stock) || [];
            const builtin = opSimStarts('alignment', c, stock) || [];
            if (twin.length !== 2 || builtin.length !== 2) { countFails++; if (!firstFail) firstFail = { c, reason: 'count', twinN: twin.length, builtinN: builtin.length }; continue; }
            for (let i = 0; i < 2; i++) if (r3(twin[i].x) !== r3(builtin[i].x) || r3(twin[i].y) !== r3(builtin[i].y) || r3(twin[i].z) !== r3(builtin[i].z)) {
                posFails++; if (!firstFail) firstFail = { c, reason: 'pos', i, twin: twin[i], builtin: builtin[i] }; break;
            }
        }
        const M = { ...D, travel: 'manual' };   // t510 — compare the MANUAL emit (stock-independent, byte-identical); AUTO byte-identity is its own test
        const emitSame = emitMapped(builderOf('user_alignment_data')({ ...M })).text === emitMapped(alignmentStack({ ...M })).text
            && emitMapped(builderOf('user_alignment_data')({ ...M, checkAxis: 'Y', probeDir: 'neg' })).text === emitMapped(alignmentStack({ ...M, checkAxis: 'Y', probeDir: 'neg' })).text;
        return { posFails, countFails, firstFail, emitSame };
    });
    if (r.firstFail) console.log('E2 SIM-START FAIL: ' + JSON.stringify(r.firstFail));
    expect(r.countFails, 'the twin declares exactly 2 sim-starts (A + B), matching BUILT_IN.alignment').toBe(0);
    expect(r.posFails, 'the twin start POSITIONS == BUILT_IN.alignment across combos (0 fails)').toBe(0);
    expect(r.emitSame, 'emit BYTE-IDENTICAL (the provider is sim-only, via the registry not the builder)').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E2 real-symptom: the twin renders the BOX + the 2 fence starts on the preview (alignment = a fence probe, NO rig/bar)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true } }); });
    await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/alignmentData.js'); localStorage.removeItem('ddcs_user_ops'); try { U.deleteUserOp('user_alignment_data'); } catch (_) {} U.createUserOp(M.alignmentDataDef()); });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz._partGroup; }, { timeout: 8000 });
    await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { ALIGNMENT_DEFAULTS } = await import('/blocks/dataOps/alignmentData.js');
        const starts = opSimStarts('user_alignment_data', { ...ALIGNMENT_DEFAULTS }, (window.ddcsGetSettings() || {}).stock) || [];
        const viz = window.ddcsStudio.wizardManager._activePanel.viz;
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        return {
            nStarts: starts.length, hasViz: !!document.querySelector('#wiz_user canvas'),
            stockShape: viz._stock && viz._stock.shape, noRig: !viz._rotaryFixture,
            fieldCount: params.length, hasCheckAxis: params.includes('checkAxis'), hasProbeDir: params.includes('probeDir'), hasSafeZ: params.includes('safeZ'), hasTolerance: params.includes('tolerance'),
        };
    });
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/alignment_e2_sim.png' });
    expect(r.nStarts, 'the alignment declares 2 sim-starts (A + B along the fence)').toBe(2);
    expect(r.hasViz, 'the machine-frame preview renders').toBe(true);
    expect(r.stockShape, 'the sim shows a rectangular BOX (a fence probe — no round bar)').toBe('box');
    expect(r.noRig, 'NO 4th-axis rig (alignment is not rotary)').toBe(true);
    expect(r.fieldCount, 'the form is NON-EMPTY').toBeGreaterThan(6);
    expect(r.hasCheckAxis && r.hasProbeDir && r.hasSafeZ && r.hasTolerance, 'the checkAxis/probeDir/safeZ/tolerance knobs render').toBe(true);
});
