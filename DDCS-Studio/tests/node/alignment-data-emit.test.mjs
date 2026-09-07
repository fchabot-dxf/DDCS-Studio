import { test, expect } from './support/harness.mjs';

/**
 * ALIGNMENT PORT E1+E2 — the data-op twin's emit is BYTE-IDENTICAL to the built-in alignmentStack + the (existing) sim-starts.
 * The E0 superset (banked, 9b531e3) guards checkAxis×probeDir (4 arms); the 6 value bindings re-inject the scalars (#19 safeZ
 * bindable via F2); the value-swaps (safeZFrame + the scalar/tolerance header comment — F3 tolerance display-only) are
 * RECOMPOSED in postInstantiate. E2: def.simStartsProvider reuses the EXISTING BUILT_IN.alignment (2 starts A/B). VERIFY:
 * (a) byte-diff ZERO across the 8-combo structural + a scalar sweep, studio AND Expert; (b) sim-starts POSITIONS+COUNT ==
 * BUILT_IN.alignment (2); (c) the sim renders the box + 2 starts (NO rig/simStock). INDEPENDENT TRUTH: the built-in is a separate path.
 *
 * t2694 — TIER MIGRATION WORK PACKAGE 4: split from alignment-data-emit.spec.js. This file keeps the FIRST TWO tests
 * (E1 byte-diff + E2 sim-starts positions) — pure page.goto + page.evaluate importing app modules, registering the op
 * explicitly (registerUserOp(alignmentDataDef())), calling builderOf/emitMapped/opSimStarts, and asserting on plain
 * returned data — no DOM. The THIRD test ("E2 real-symptom: the twin renders the BOX...") opens a real wizard
 * (window.openWiz), waits on a real DOM selector + a rendered viz panel, and reads live form/canvas DOM — a genuine
 * app+DOM+render dependency, not a candidate for this tier. It stays in tests/alignment-data-emit-drive.spec.js.
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
        // t1634 — the twin is NOT a second source for the ATAN line (fork parity via alignmentStack), but VERIFY it
        // rather than assume: the byte-diff loop above would already go red on a divergence, so this just names it.
        const twinDefault = emitMapped(build(D)).text;
        return {
            structCount: structCombos.length, studioDiffs, expertDiffs, firstDiff,
            wireDist: /^#1=99 \(/m.test(wireDist),
            wireSafeZ: /^#19=99 \(/m.test(wireSafeZ) && /^#20=\[0-#19\] /m.test(wireSafeZ),   // #19 binds, #20 STAYS the ref
            hasCommaAtan: /#54=ATAN\[#52, #53\]/.test(twinDefault),
        };
    });
    expect(r.structCount, 'the full structural sweep is 2×2×2 = 8 combos').toBe(8);
    if (r.firstDiff) console.log('E1 DIFF [' + r.firstDiff.profile + '] @ ' + JSON.stringify(r.firstDiff.p) + ' line ' + r.firstDiff.line + '\n--TWIN--\n' + (r.firstDiff.twinCtx || []).join('\n') + '\n--BUILTIN--\n' + (r.firstDiff.builtinCtx || []).join('\n'));
    expect(r.studioDiffs, 'STUDIO: byte-diff ZERO across 8 struct + scalar combos (guards pruned, scalars bound, header/tolerance recomposed)').toBe(0);
    expect(r.expertDiffs, 'EXPERT: byte-diff ZERO (source-chips #2/#3/#5 → registers, matching the built-in)').toBe(0);
    expect(r.wireDist, 'WIRING: dist=99 lands in #1').toBe(true);
    expect(r.wireSafeZ, 'WIRING: safeZ=99 lands in #19 and #20 STAYS [0-#19] (F2 — the ref tracks)').toBe(true);
    expect(r.hasCommaAtan, 't1634: the twin emits the comma-form ATAN, not a hand-copied slash string').toBe(true);
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
