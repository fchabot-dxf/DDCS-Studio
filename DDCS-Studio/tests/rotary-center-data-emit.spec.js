import { test, expect } from '@playwright/test';

/**
 * ROTARY CENTRELINE PORT E1 — the data-op twin's emit is BYTE-IDENTICAL to the built-in rotaryCenterStack (t413). The E0
 * superset (banked, c2bfe6e) guards method/approach; the value bindings re-inject the scalars; the value-swaps
 * (datum/wcs/safeZFrame + the interpolated header) are RECOMPOSED from resolved params in postInstantiate. VERIFY byte-diff
 * ZERO across (a) the full 112-combo structural sweep at default scalars, (b) a scalar sweep, (c) WIRING — on BOTH profiles
 * (studio + Expert source-resolver stubbed). The FIT ADVANCED banner stays. INDEPENDENT TRUTH: the built-in is a separate path.
 */
test('E1 byte-diff ZERO: user_rotary_center_data == rotaryCenterStack across 112 structural + a scalar sweep, studio AND Expert', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { rotaryCenterDataDef, ROTARY_CENTER_DEFAULTS } = await import('/blocks/dataOps/rotaryCenterData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
        registerUserOp(rotaryCenterDataDef());   // NOT seeded yet (E1) → register for the test
        const build = builderOf('user_rotary_center_data');
        const D = ROTARY_CENTER_DEFAULTS;

        const METHODS = ['known', 'fit'], APPR = ['auto', 'guided'], DAT = ['center', 'top'];
        const WCSV = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'], FR = ['relative', 'machine'];
        const structCombos = [];
        for (const method of METHODS) for (const approach of APPR) for (const datum of DAT) for (const wcs of WCSV) for (const safeZFrame of FR)
            structCombos.push({ ...D, method, approach, datum, wcs, safeZFrame });
        const scalarCombos = [
            { ...D, dist: 40, retract: 3, f_fast: 250, f_slow: 40 },
            { ...D, radius: 3, safeZ: 20, diameter: 50.8 },
            { ...D, port: 4, method: 'known', diameter: 25.4 },
            { ...D, method: 'fit', dist: 55, retract: 4 },   // fit arm scalars (no diameter socket)
        ];
        const all = [...structCombos, ...scalarCombos];

        const orig = window.ddcsResolveProbeSources;
        let studioDiffs = 0, expertDiffs = 0, firstDiff = null;
        const lineDiff = (twin, builtin, p) => {
            const tl = twin.split('\n'), bl = builtin.split('\n');
            let li = 0; while (li < tl.length && li < bl.length && tl[li] === bl[li]) li++;
            return { p, line: li, twinLine: tl[li], builtinLine: bl[li], twinCtx: tl.slice(Math.max(0, li - 1), li + 2), builtinCtx: bl.slice(Math.max(0, li - 1), li + 2) };
        };
        window.ddcsResolveProbeSources = () => ({});
        for (const p of all) {
            const twin = emitMapped(build(p)).text;
            const builtin = emitMapped(rotaryCenterStack(p)).text;
            if (twin !== builtin) { studioDiffs++; if (!firstDiff) firstDiff = { profile: 'studio', ...lineDiff(twin, builtin, { method: p.method, approach: p.approach, datum: p.datum, wcs: p.wcs, safeZFrame: p.safeZFrame }) }; }
        }
        const REG = { port: '#1078', fastFeed: '#1080', retract: '#1082' };
        window.ddcsResolveProbeSources = () => ({ ...REG });
        for (const p of all) {
            const twin = emitMapped(build(p)).text;
            const builtin = emitMapped(rotaryCenterStack({ ...p, sources: { ...REG } })).text;
            if (twin !== builtin) { expertDiffs++; if (!firstDiff) firstDiff = { profile: 'expert', p: { method: p.method, wcs: p.wcs }, twin: twin.slice(0, 1500), builtin: builtin.slice(0, 1500) }; }
        }
        window.ddcsResolveProbeSources = orig;
        // WIRING — a sentinel scalar lands in its socket
        const wireDist = emitMapped(build({ ...D, dist: 99 })).text;
        const wireDia = emitMapped(build({ ...D, method: 'known', diameter: 12.7 })).text;
        return {
            structCount: structCombos.length, scalarCount: scalarCombos.length, studioDiffs, expertDiffs, firstDiff,
            fitAdvanced: /ADVANCED: verify on machine/.test(emitMapped(build({ ...D, method: 'fit' })).text),
            wireDist: /^#1=99 \(/m.test(wireDist), wireDia: /^#57=12\.7 \(/m.test(wireDia),
        };
    });
    expect(r.structCount, 'the full structural sweep is 112 combos').toBe(112);
    if (r.firstDiff) console.log('E1 DIFF [' + r.firstDiff.profile + '] @ ' + JSON.stringify(r.firstDiff.p) + ' line ' + r.firstDiff.line + '\n--TWIN--\n' + (r.firstDiff.twinCtx || []).join('\n') + '\n--BUILTIN--\n' + (r.firstDiff.builtinCtx || []).join('\n'));
    expect(r.studioDiffs, 'STUDIO: byte-diff ZERO across 112 struct + scalar combos (value-swaps recomposed, scalars bound)').toBe(0);
    expect(r.expertDiffs, 'EXPERT: byte-diff ZERO (source-chips #2/#3/#5 → registers, matching the built-in)').toBe(0);
    expect(r.wireDist, 'WIRING: dist=99 lands in #1').toBe(true);
    expect(r.wireDia, 'WIRING: diameter=12.7 lands in the #57 socket (E0 dissolve)').toBe(true);
    expect(r.fitAdvanced, 'the FIT ADVANCED banner stays in the twin').toBe(true);
});
