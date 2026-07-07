import { test, expect } from '@playwright/test';

/**
 * ROTARY CENTRELINE PORT E0 — the rotaryCenterStack SUPERSET is the GATE + the golden baseline.
 *
 * Rotary has NO dumped M350 probing macro (the fan-out scout, t393) → the wizard's OWN emit IS the byte ground truth.
 * The E0 gate: `rotaryCenterStack(S, {superset:true})` pruned by S must be BYTE-IDENTICAL to the concrete
 * `rotaryCenterStack(S, {superset:false})` across the FULL structural sweep. rotary's ONLY block-shape forks are
 * method(known|fit) + the approach(auto|guided) confirm gate NESTED in known; datum / wcs / safeZFrame are VALUE swaps
 * (same block shape, different value — read from S on BOTH sides). Sweep = method × approach × datum × wcs × safeZFrame
 * = 2×2×2×7×2 = 112. INDEPENDENT TRUTH: the concrete builder is a SEPARATE code path. If it does NOT match, the port
 * STOPS here (E0 precedes E1). The 2 byte-clean restructures: #55=dia/2 dissolved to #57 (a single socket) + the
 * safeZ Math.round dropped (byte-identical at the integer default). The FIT ADVANCED banner STAYS (Studio-original).
 */
test('E0 GATE: prune(rotaryCenterStack superset) == concrete rotaryCenterStack, byte-identical across the full 112-combo structural sweep', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
        const { pruneGuards } = await import('/blocks/whenGuard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');

        const METHODS = ['known', 'fit'], APPROACH = ['auto', 'guided'], DATUM = ['center', 'top'];
        const WCSV = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'], FRAME = ['relative', 'machine'];
        const combos = [];
        for (const method of METHODS)
            for (const approach of APPROACH)
                for (const datum of DATUM)
                    for (const wcs of WCSV)
                        for (const safeZFrame of FRAME)
                            combos.push({ method, approach, datum, wcs, safeZFrame });

        let diffCount = 0, leftoverGuards = 0, supGuardMax = 0, firstDiff = null;
        for (const c of combos) {
            const sup = rotaryCenterStack(c, { superset: true });   // both method/approach arms present, each guarded
            supGuardMax = Math.max(supGuardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
            pruneGuards(sup, c);                                     // collapse to the concrete shape for c
            if (JSON.stringify(sup).includes('"type":"guard"')) leftoverGuards++;
            const a = emitMapped(sup).text;                         // the pruned superset
            const b = emitMapped(rotaryCenterStack(c, { superset: false })).text;   // the concrete (INDEPENDENT path)
            if (a !== b) { diffCount++; if (!firstDiff) firstDiff = { c, a: a.slice(0, 1600), b: b.slice(0, 1600) }; }
        }
        return { comboCount: combos.length, diffCount, leftoverGuards, supGuardMax, firstDiff };
    });
    expect(r.comboCount, 'the full structural sweep is 2×2×2×7×2 = 112 combos').toBe(112);
    expect(r.supGuardMax, 'the superset carries guard blocks (method known|fit + approach guided → ≥3)').toBeGreaterThanOrEqual(3);
    expect(r.leftoverGuards, 'prune leaves ZERO guard blocks (fully collapsed to the concrete shape)').toBe(0);
    if (r.firstDiff) console.log('FIRST DIFF @ ' + JSON.stringify(r.firstDiff.c) + '\n--- PRUNED ---\n' + r.firstDiff.a + '\n--- CONCRETE ---\n' + r.firstDiff.b);
    expect(r.diffCount, 'prune(superset) is BYTE-IDENTICAL to concrete rotaryCenterStack for ALL 112 combos (the E0 gate; byte-diff = ZERO)').toBe(0);
});

/**
 * The golden baseline + the 2 byte-clean restructures. superset:false IS the concrete/default path (the wizard emit =
 * the ground truth, no dumped macro). Assert the restructures landed correctly + value-equivalent + the ADVANCED banner.
 */
test('E0 golden + restructures: #55=dia/2 dissolved to a #57 socket · safeZ Math.round dropped · the FIT ADVANCED banner stays · superset:false == concrete', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const known = emitMapped(rotaryCenterStack({ method: 'known', diameter: 76.2, safeZ: 15 })).text;
        const fit = emitMapped(rotaryCenterStack({ method: 'fit' })).text;
        // superset:false === the default concrete (the golden self-consistency)
        const dflt = emitMapped(rotaryCenterStack({ method: 'known' })).text;
        const sup0 = emitMapped(rotaryCenterStack({ method: 'known' }, { superset: false })).text;
        return {
            // RESTRUCTURE #1 — the diameter is a single socket #57 (= 76.2), R = [#57/2] (was baked #55=76.2/2)
            hasDiaSocket: /^#57=76\.2 \( Known diameter \)/m.test(known),
            hasRfromSocket: /^#55=\[#57\/2\] \(/m.test(known),
            noBakedDia: !/#55=76\.2\/2/.test(known),
            // RESTRUCTURE #2 — safeZ lands raw (no Math.round); byte-identical at the integer default 15
            hasRawSafeZ: /^#17=15 \( Safe Z \)/m.test(known),
            // the FIT ADVANCED banner STAYS (Studio-original, machine-unvalidated)
            fitAdvanced: /ADVANCED: verify on machine/.test(fit),
            fitSolver: /SQRT\[/.test(fit) && /twice signed area/.test(fit),
            supFalseEqDefault: dflt === sup0,
        };
    });
    expect(r.hasDiaSocket, 'RESTRUCTURE #1: diameter is a single socket #57 (E1-bindable)').toBe(true);
    expect(r.hasRfromSocket, 'R is derived from the socket: #55=[#57/2]').toBe(true);
    expect(r.noBakedDia, 'the old baked #55=76.2/2 is gone').toBe(true);
    expect(r.hasRawSafeZ, 'RESTRUCTURE #2: #17=15 (safeZ raw, Math.round dropped — byte-identical at the integer default)').toBe(true);
    expect(r.fitAdvanced, 'the FIT ADVANCED banner STAYS (Studio-original, machine-unvalidated)').toBe(true);
    expect(r.fitSolver, 'the 3-point fit solver is intact (SQRT + the determinant)').toBe(true);
    expect(r.supFalseEqDefault, 'superset:false IS the concrete/default path (byte-identical)').toBe(true);
});
