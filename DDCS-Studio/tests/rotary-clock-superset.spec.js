import { test, expect } from '@playwright/test';

/**
 * ROTARY CLOCK PORT E0 — the rotaryClockStack SUPERSET is the GATE + the golden baseline (phase C, the A-axis inheritor).
 *
 * The Clock is a DISTINCT wizard (datum the rotary axis off a FLAT: two Z-down touches a SPAN apart → tilt phi → A datum;
 * #6 = SPAN, no radius comp — a flat cancels it; it hand-rolls its two-pass probe, ppZdown). Like the Centreline it has NO
 * dumped M350 macro → the wizard's OWN emit IS the byte ground truth. The E0 gate: `rotaryClockStack(S, {superset:true})`
 * pruned by S must be BYTE-IDENTICAL to the concrete `rotaryClockStack(S, {superset:false})` across the FULL structural
 * sweep. The Clock's ONLY block-shape fork is action(set|report|rotate); reference(top|side) + safeZFrame(relative|machine)
 * + wcs are VALUE swaps (same block shape, read from params on BOTH sides). Sweep = action × reference × safeZFrame × wcs
 * = 3×2×2×7 = 84. INDEPENDENT TRUTH: the concrete builder is a SEPARATE code path. If it does NOT match, the port STOPS
 * here (E0 precedes E1). The 1 byte-clean restructure: the safeZ Math.round dropped (byte-identical at the integer default).
 * The A-axis writes (RM/SWO/MV of A) STAY in the concrete arms — E1 binds the A-axis.
 */
test('E0 GATE: prune(rotaryClockStack superset) == concrete rotaryClockStack, byte-identical across the full 84-combo structural sweep', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { rotaryClockStack } = await import('/wizards/rotaryClockWizard.js');
        const { pruneGuards } = await import('/blocks/whenGuard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');

        const ACTION = ['set', 'report', 'rotate'], REFERENCE = ['top', 'side'];
        const FRAME = ['relative', 'machine'], WCSV = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'];
        const combos = [];
        for (const action of ACTION)
            for (const reference of REFERENCE)
                for (const safeZFrame of FRAME)
                    for (const wcs of WCSV)
                        combos.push({ action, reference, safeZFrame, wcs });

        let diffCount = 0, leftoverGuards = 0, supGuardMax = 0, firstDiff = null;
        for (const c of combos) {
            const sup = rotaryClockStack(c, { superset: true });   // all 3 action arms present, each guarded
            supGuardMax = Math.max(supGuardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
            pruneGuards(sup, c);                                    // collapse to the concrete shape for c
            if (JSON.stringify(sup).includes('"type":"guard"')) leftoverGuards++;
            const a = emitMapped(sup).text;                        // the pruned superset
            const b = emitMapped(rotaryClockStack(c, { superset: false })).text;   // the concrete (INDEPENDENT path)
            if (a !== b) { diffCount++; if (!firstDiff) firstDiff = { c, a: a.slice(0, 1600), b: b.slice(0, 1600) }; }
        }
        return { comboCount: combos.length, diffCount, leftoverGuards, supGuardMax, firstDiff };
    });
    expect(r.comboCount, 'the full structural sweep is 3×2×2×7 = 84 combos').toBe(84);
    expect(r.supGuardMax, 'the superset carries the 3 action guard blocks (set|report|rotate)').toBeGreaterThanOrEqual(3);
    expect(r.leftoverGuards, 'prune leaves ZERO guard blocks (fully collapsed to the concrete shape)').toBe(0);
    if (r.firstDiff) console.log('FIRST DIFF @ ' + JSON.stringify(r.firstDiff.c) + '\n--- PRUNED ---\n' + r.firstDiff.a + '\n--- CONCRETE ---\n' + r.firstDiff.b);
    expect(r.diffCount, 'prune(superset) is BYTE-IDENTICAL to concrete rotaryClockStack for ALL 84 combos (the E0 gate; byte-diff = ZERO)').toBe(0);
});

/**
 * The golden baseline + the byte-clean restructure. superset:false IS the concrete/default path (the wizard emit = the
 * ground truth, no dumped macro). Assert the restructure landed + value-equivalent + the 3 action arms emit as expected.
 */
test('E0 golden + restructure: safeZ Math.round dropped (raw #17, E1-bindable) · the 3 action arms · reference value-swap · superset:false == concrete', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { rotaryClockStack } = await import('/wizards/rotaryClockWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const E = (p) => emitMapped(rotaryClockStack(p)).text;
        const setTop = E({ action: 'set', reference: 'top' });
        const setSide = E({ action: 'set', reference: 'side' });
        const report = E({ action: 'report' });
        const rotate = E({ action: 'rotate', reference: 'top' });
        // superset:false === the default concrete (the golden self-consistency)
        const dflt = E({ action: 'set' });
        const sup0 = emitMapped(rotaryClockStack({ action: 'set' }, { superset: false })).text;
        return {
            // RESTRUCTURE — safeZ lands raw (no Math.round): byte-identical at the integer default 10, raw at 12.5 (proves the drop)
            hasRawSafeZDefault: /^#17=10 \( Safe Z \)/m.test(setTop),
            rawSafeZFraction: /^#17=12\.5 \( Safe Z \)/m.test(E({ action: 'set', safeZ: 12.5 })),
            // #6 = the SPAN socket (single, E1-bindable), NOT a radius
            hasSpanSocket: /^#6=20 \( Y span between the two flat touches \)/m.test(setTop),
            // ACTION arm: SET — SWO A [#54-#53] (top) / [#54-#53-90] (side); no rotate move
            setTopSWO: /#54-#53\]/.test(setTop) && !/#54-#53-90/.test(setTop) && !/Rotation to reach/.test(setTop),
            setSideRefTerm: /#54-#53-90\]/.test(setSide),
            // ACTION arm: REPORT — measure only, NO SWO of A
            reportMeasureOnly: /Measure only - A offset left unchanged/.test(report) && !/#54-#53/.test(report),
            // ACTION arm: ROTATE — rotation term + the A rotate move + A read + A0 set
            rotateFull: /#58=\[0-#53\]/.test(rotate) && /Rotation to reach the reference/.test(rotate) && /SPINS THE PART/.test(rotate),
            supFalseEqDefault: dflt === sup0,
        };
    });
    expect(r.hasRawSafeZDefault, 'RESTRUCTURE: #17=10 (safeZ raw, Math.round dropped — byte-identical at the integer default)').toBe(true);
    expect(r.rawSafeZFraction, 'a fractional safeZ lands RAW (#17=12.5, not rounded to 13) — the restructure enables the E1 #17 binding').toBe(true);
    expect(r.hasSpanSocket, '#6 is the single SPAN socket (E1-bindable), not a radius').toBe(true);
    expect(r.setTopSWO, 'SET@top emits SWO A [#54-#53] (no side term, no rotate move)').toBe(true);
    expect(r.setSideRefTerm, 'SET@side value-swaps the refTerm → [#54-#53-90]').toBe(true);
    expect(r.reportMeasureOnly, 'REPORT emits "measure only" and NO SWO of A').toBe(true);
    expect(r.rotateFull, 'ROTATE emits the rotation term #58=[0-#53] + the SPINS-THE-PART warning').toBe(true);
    expect(r.supFalseEqDefault, 'superset:false IS the concrete/default path (byte-identical)').toBe(true);
});
