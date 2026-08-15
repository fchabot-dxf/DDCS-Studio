import { test, expect } from '@playwright/test';

/**
 * ROTARY CLOCK PORT E1 — the data-op twin's emit is BYTE-IDENTICAL to the built-in rotaryClockStack (phase C). The E0
 * superset (banked, a1f1112) guards action(set|report|rotate); the value bindings re-inject the 7 scalars (#6=SPAN); the
 * value-swaps (reference/wcs/safeZFrame + the interpolated header + the action-dependent message) are RECOMPOSED from
 * resolved params in postInstantiate. VERIFY byte-diff ZERO across (a) the full 84-combo structural sweep at default
 * scalars, (b) a scalar sweep, (c) WIRING — on BOTH profiles (studio + Expert source-resolver stubbed). SPECIAL FOCUS: the
 * A-AXIS ATOMS (RM/SWO/MV of A + the computed #58) — the FIRST A-axis emit any twin makes — pass through byte-identical.
 * INDEPENDENT TRUTH: the built-in is a separate code path.
 */
test('E1 byte-diff ZERO: user_rotary_clock_data == rotaryClockStack across 84 structural + a scalar sweep, studio AND Expert; the A-axis atoms pass through', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { rotaryClockDataDef, ROTARY_CLOCK_DEFAULTS } = await import('/blocks/dataOps/rotaryClockData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { rotaryClockStack } = await import('/wizards/rotaryClockWizard.js');
        registerUserOp(rotaryClockDataDef());   // NOT seeded yet (E1) → register for the test
        const build = builderOf('user_rotary_clock_data');
        const D = ROTARY_CLOCK_DEFAULTS;

        const ACTION = ['set', 'report', 'rotate'], REFERENCE = ['top', 'side'];
        const FR = ['relative', 'machine'], WCSV = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'];
        const structCombos = [];
        for (const action of ACTION) for (const reference of REFERENCE) for (const safeZFrame of FR) for (const wcs of WCSV)
            structCombos.push({ ...D, action, reference, safeZFrame, wcs });
        const scalarCombos = [
            { ...D, dist: 40, retract: 3, f_fast: 250, f_slow: 40 },
            { ...D, span: 35, safeZ: 20, port: 4 },
            { ...D, action: 'rotate', reference: 'side', span: 12.5 },   // the A-axis arm with a fractional scalar
            { ...D, action: 'report', dist: 55, retract: 4 },
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
            const builtin = emitMapped(rotaryClockStack(p)).text;
            if (twin !== builtin) { studioDiffs++; if (!firstDiff) firstDiff = { profile: 'studio', ...lineDiff(twin, builtin, { action: p.action, reference: p.reference, wcs: p.wcs, safeZFrame: p.safeZFrame }) }; }
        }
        const REG = { port: '#1078', fastFeed: '#1080', retract: '#1082' };
        window.ddcsResolveProbeSources = () => ({ ...REG });
        for (const p of all) {
            const twin = emitMapped(build(p)).text;
            const builtin = emitMapped(rotaryClockStack({ ...p, sources: { ...REG } })).text;
            if (twin !== builtin) { expertDiffs++; if (!firstDiff) firstDiff = { profile: 'expert', ...lineDiff(twin, builtin, { action: p.action, wcs: p.wcs }) }; }
        }
        window.ddcsResolveProbeSources = orig;

        // WIRING — sentinel scalars land in their sockets
        const wireDist = emitMapped(build({ ...D, dist: 99 })).text;
        const wireSpan = emitMapped(build({ ...D, span: 99 })).text;
        // A-AXIS ATOMS — the rotate arm emits the A moves; confirm byte-identical to the built-in + the atoms are present
        const rotSide = { ...D, action: 'rotate', reference: 'side' };
        const twinRot = emitMapped(build(rotSide)).text, builtinRot = emitMapped(rotaryClockStack(rotSide)).text;
        return {
            structCount: structCombos.length, scalarCount: scalarCombos.length, studioDiffs, expertDiffs, firstDiff,
            wireDist: /^#1=99 \(/m.test(wireDist), wireSpan: /^#6=99 \(/m.test(wireSpan),
            rotByteEqual: twinRot === builtinRot,
            // the A-axis atoms emit via the dialect: computed #58, `G0 A#58` (the A rotate MOVE), `#59=#883` (the A DRO read),
            // `#[805+[#578-1]*5+3]=#59` (the A work-offset write via the WCS stride +3) — no special handling in the twin.
            rotHasAtoms: /#58=\[0-#53-90\]/.test(twinRot) && /G0 A#58/.test(twinRot) && /#59=#883/.test(twinRot) && /\*5\+3\]=#59/.test(twinRot),
            reportNoSWO: !/#54-#53/.test(emitMapped(build({ ...D, action: 'report' })).text),
        };
    });
    expect(r.structCount, 'the full structural sweep is 3×2×2×7 = 84 combos').toBe(84);
    if (r.firstDiff) console.log('E1 DIFF [' + r.firstDiff.profile + '] @ ' + JSON.stringify(r.firstDiff.p) + ' line ' + r.firstDiff.line + '\n--TWIN--\n' + (r.firstDiff.twinCtx || []).join('\n') + '\n--BUILTIN--\n' + (r.firstDiff.builtinCtx || []).join('\n'));
    expect(r.studioDiffs, 'STUDIO: byte-diff ZERO across 84 struct + scalar combos (value-swaps recomposed, scalars bound)').toBe(0);
    expect(r.expertDiffs, 'EXPERT: byte-diff ZERO (source-chips #2/#3/#5 → registers, matching the built-in)').toBe(0);
    expect(r.wireDist, 'WIRING: dist=99 lands in #1').toBe(true);
    expect(r.wireSpan, 'WIRING: span=99 lands in the #6 SPAN socket').toBe(true);
    expect(r.rotByteEqual, 'A-AXIS: the rotate arm emit is byte-identical to the built-in (the A atoms pass through the twin machinery untouched)').toBe(true);
    expect(r.rotHasAtoms, 'A-AXIS: the twin emits the computed #58=[0-#53-90] + the A rotate move (A#58) + the A read/set (A#59)').toBe(true);
    expect(r.reportNoSWO, 'REPORT: no A work-offset write (measure only) — the action guard pruned the SWO').toBe(true);
});

/**
 * t1900 — CROSS-DIALECT. `rotaryClockWizard.js` has NO build-time dialect read (t1896 census, SAFE — per-post
 * variation delegated to atoms, resolved at emit). "studio AND Expert" above never switches the dialect.
 */
test('CROSS-DIALECT: user_rotary_clock_data == rotaryClockStack for EVERY registered dialect (t1900)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { rotaryClockDataDef, ROTARY_CLOCK_DEFAULTS } = await import('/blocks/dataOps/rotaryClockData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { rotaryClockStack } = await import('/wizards/rotaryClockWizard.js');
        const { resolveActivePost, listPosts } = await import('/wizards/dialects/index.js');
        registerUserOp(rotaryClockDataDef());
        const build = builderOf('user_rotary_clock_data');
        const D = ROTARY_CLOCK_DEFAULTS;
        const reps = [D, { ...D, action: 'rotate', reference: 'side', span: 12.5 }];
        const dialects = listPosts().map((p) => p.id);
        let diffs = 0, first = null, combos = 0;
        for (const dialectId of dialects) {
            const post = resolveActivePost(dialectId);
            for (const p of reps) {
                combos++;
                const twin = emitMapped(build(p), post).text;
                const builtin = emitMapped(rotaryClockStack(p), post).text;
                if (twin !== builtin) { diffs++; if (!first) first = { dialectId, p: { action: p.action }, twin: twin.slice(0, 600), builtin: builtin.slice(0, 600) }; }
            }
        }
        return { diffs, first, combos, dialectCount: dialects.length };
    });
    if (r.first) console.log('ROTARY-CLOCK XDIALECT DIFF ' + JSON.stringify(r.first));
    expect(r.dialectCount, 'sanity: 7 registered dialects').toBe(7);
    expect(r.combos, 'the sweep = 7 dialects × 2 representative actions').toBe(14);
    expect(r.diffs, 'twin emit == rotaryClockStack for EVERY registered dialect (byte-diff = ZERO)').toBe(0);
});
