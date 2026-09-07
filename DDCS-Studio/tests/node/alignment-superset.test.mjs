import { test, expect } from './support/harness.mjs';

/**
 * ALIGNMENT PORT E0 — the alignmentStack SUPERSET is the GATE + the golden baseline (the LAST probe fan-out port).
 *
 * Alignment measures a fence misalignment angle (2 touches A→B, atan(delta/span) → #1512). NO dumped angle macro (the M350
 * xy_fence_finder is a POSITION finder) → the wizard's OWN emit IS the byte ground truth. The E0 gate: `alignmentStack(S,
 * {superset:true})` pruned by S must be BYTE-IDENTICAL to the concrete `alignmentStack(S, {superset:false})` across the FULL
 * structural sweep. F1: the checkAxis(X|Y) × probeDir(pos|neg) forks are GUARDED (4 arms) — the axis-letter + probe-var swap
 * threads through ~16 atoms + the entangled header comment, too pervasive to recompose. safeZFrame is a VALUE-swap (read from
 * params on BOTH sides). Sweep = checkAxis × probeDir × safeZFrame = 2×2×2 = 8. F2: #20 restructured [0-safeZ] → [0-#19].
 *
 * t2694 — TIER MIGRATION WORK PACKAGE 4: moved browser→node whole-file. Both tests are pure: each body is
 * page.goto + one page.evaluate that imports app modules, calls alignmentStack/pruneGuards/emitMapped, and asserts on
 * plain returned data — no DOM read, no click, no screenshot.
 */
test('E0 GATE: prune(alignmentStack superset) == concrete alignmentStack, byte-identical across the full 8-combo structural sweep', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { pruneGuards } = await import('/blocks/whenGuard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');

        const { alignEffectiveTravel } = await import('/wizards/ops/alignPoints.js');
        const CHECK = ['X', 'Y'], DIR = ['pos', 'neg'], TRAVEL = ['auto', 'manual'];   // t544 — sweep BOTH travel arms
        const combos = [];
        for (const checkAxis of CHECK) for (const probeDir of DIR) for (const travel of TRAVEL)
            combos.push({ checkAxis, probeDir, travel, span: 55 });

        let diffCount = 0, leftoverGuards = 0, supGuardMax = 0, firstDiff = null;
        for (const c of combos) {
            const sup = alignmentStack(c, { superset: true });   // all checkAxis×probeDir × travel arms present, each guarded
            supGuardMax = Math.max(supGuardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
            // t544 — prune with the EFFECTIVE travel (auto default | manual) — the SAME the concrete alignmentStack resolves
            // via alignEffectiveTravel. AUTO no longer binds stock coords (the span is a plain #73 scalar) → prune==concrete.
            pruneGuards(sup, { ...c, travel: alignEffectiveTravel(c) });   // collapse to the concrete shape for c
            if (JSON.stringify(sup).includes('"type":"guard"')) leftoverGuards++;
            const a = emitMapped(sup).text;                      // the pruned superset
            const b = emitMapped(alignmentStack(c, { superset: false })).text;   // the concrete (INDEPENDENT path)
            if (a !== b) { diffCount++; if (!firstDiff) firstDiff = { c, a: a.slice(0, 1600), b: b.slice(0, 1600) }; }
        }
        return { comboCount: combos.length, diffCount, leftoverGuards, supGuardMax, firstDiff };
    });
    expect(r.comboCount, 'the full structural sweep is 2×2×2 = 8 combos').toBe(8);
    expect(r.supGuardMax, 'the superset carries the checkAxis×probeDir guard blocks (2 outer + 4 inner = 6)').toBeGreaterThanOrEqual(4);
    expect(r.leftoverGuards, 'prune leaves ZERO guard blocks (fully collapsed to the concrete shape)').toBe(0);
    if (r.firstDiff) console.log('FIRST DIFF @ ' + JSON.stringify(r.firstDiff.c) + '\n--- PRUNED ---\n' + r.firstDiff.a + '\n--- CONCRETE ---\n' + r.firstDiff.b);
    expect(r.diffCount, 'prune(superset) is BYTE-IDENTICAL to concrete alignmentStack for ALL 8 combos (the E0 gate; byte-diff = ZERO)').toBe(0);
});

/**
 * The golden baseline + the F2 restructure. superset:false IS the concrete/default path (the wizard emit = the ground truth,
 * no dumped angle macro). Assert the #20 restructure landed ([0-#19] ref, not the [0-safeZ] literal) + value-equivalent.
 */
test('E0 golden + F2 restructure: #20 = [0-#19] (references the #var, NOT the [0-safeZ] literal); value unchanged; superset:false == concrete', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const dfltEmit = emitMapped(alignmentStack({})).text;
        const bigSafeZ = emitMapped(alignmentStack({ safeZ: 25 })).text;
        const sup0 = emitMapped(alignmentStack({}, { superset: false })).text;
        return {
            // F2 — #20 references #19 (matches the #9=[0-#2] pattern), NOT the baked [0-10] literal
            has20Ref: /^#20=\[0-#19\] \( Safe Z descend distance - negative \)/m.test(dfltEmit),
            noBakedNeg: !/#20=\[0-10\]/.test(dfltEmit),
            // #19 = safeZ (the binding target for E1); at safeZ=25 → #19=25 and #20 STAYS [0-#19] (the ref never bakes the value)
            has19: /^#19=10 \( Safe Z lift distance - positive \)/m.test(dfltEmit),
            has19Big: /^#19=25 \(/m.test(bigSafeZ) && /^#20=\[0-#19\] /m.test(bigSafeZ),
            // the angle compute is intact (the alignment purpose)
            hasAngle: /#1512=#54/.test(dfltEmit) && /ATAN\[#52, #53\]/.test(dfltEmit),
            supFalseEqDefault: dfltEmit === sup0,
        };
    });
    expect(r.has20Ref, 'F2: #20 = [0-#19] (references the safeZ #var — the E1 binding lands)').toBe(true);
    expect(r.noBakedNeg, 'the old baked #20=[0-10] literal is gone').toBe(true);
    expect(r.has19, '#19 = 10 (the safeZ binding target)').toBe(true);
    expect(r.has19Big, 'at safeZ=25 → #19=25 and #20 STAYS [0-#19] (the ref tracks, never re-bakes the literal)').toBe(true);
    expect(r.hasAngle, 'the misalignment-angle compute (#1512 = atan) is intact').toBe(true);
    expect(r.supFalseEqDefault, 'superset:false IS the concrete/default path (byte-identical)').toBe(true);
});
