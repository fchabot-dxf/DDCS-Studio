import { test, expect } from '@playwright/test';

/**
 * t1601 — AN UNCLOSED BRACKET IS UNRESOLVABLE. The third member of the t1573 family (trailing tokens, the
 * stray comma, now this), and the last KNOWN place the sim was more lenient than the machine.
 *
 * Hardware-grounded, not invented. Bench probe S6f (V4.1, 2026-08-07) ran `#190 = [1 + 2` and the controller
 * answered `Unrecognized file format: L20[M30]` — it consumed everything after the unclosed `[` hunting for
 * its close, hit EOF, and blamed the LAST line of the file (photo:
 * bridge/controllers/v4.1/verify/S6f-result-L20-M30.jpg). The sim used to CLOSE the bracket silently and read
 * `[1 + 2` as 3 — a clean preview for a file the machine refuses, and (probe S6e) refuses only AFTER running
 * every line ahead of the fault, tool in the material.
 *
 * BLAME DIVERGES FROM THE HARDWARE ON PURPOSE: Studio validates per LINE, so its refusal names the line
 * holding the OPENING bracket, where the machine blames EOF. Same verdict, stricter reporting — and the line
 * the operator actually needs. The gate-side flip of the pinned leniency lives in
 * send-gate-refuses-unreadable-1585.spec.js; this spec owns the evaluator and the corpus.
 *
 * ⚠ SYNTAX, NOT VALUE — the separation t1573 exists to protect. An unset #var still reads as `unsetValue`
 * (0 on the engine, null in the preview); only the GRAMMAR tightened.
 */

test('S6f: an unclosed bracket is unresolvable at every bracket site; closed forms are untouched', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const { evalExpr, validateExpression } = await import('/engine/core/expression.js');
        const vars = new Map([[191, 42], [52, 1], [53, 1], [190, 0]]);
        const ev = (s) => ({ val: evalExpr(s, vars), engine: evalExpr(s, vars, { unsetValue: 0 }), valid: validateExpression(s) });
        return {
            // the probed form, verbatim
            s6f: ev('[1 + 2'),
            // …and every other bracket-closing site in the grammar
            group: ev('[1 + 2'),
            nested: ev('[[1 + 2]'),
            call: ev('ABS[1 + 2'),
            atanSlash: ev('ATAN[1]/[1'),
            indirect: ev('#[190 + 1'),
            trailingOpen: ev('1 + ['),
            // the CLOSED forms those tightenings must not touch
            closedGroup: ev('[1 + 2]'),
            closedNested: ev('[[1 + 2]]'),
            closedCall: ev('ABS[0 - 7]'),
            closedAtanSlash: ev('ATAN[1]/[1]'),
            closedIndirect: ev('#[190 + 1]'),
            // t1573's three hardware-refused forms — still refused
            s6a: ev('#191k8'), s6b: ev('[1 + 2 k 8]'), s6c: ev('widht'),
            // ATAN comma family (t1583) — the hardware-attested acceptances survive the tightening
            s5o: ev('ATAN[1, 1] * 100'),
            s6g: ev('ATAN[1, 2] * 100'),
            // the VALUE/syntax separation, untouched
            unset: ev('#500'),
        };
    });

    for (const k of ['s6f', 'group', 'nested', 'call', 'atanSlash', 'indirect', 'trailingOpen']) {
        expect(r[k].val, `${k}: the V4.1 refused the unclosed bracket (S6f) — the preview must not produce a number`).toBeNull();
        expect(r[k].engine, `${k}: and neither may the execution-engine reading`).toBeNull();
        expect(r[k].valid, `${k}: validateExpression must call it invalid`).toBe(false);
    }
    // the regression this closes, stated as the value the parser used to invent
    expect(r.s6f.val, 'S6f used to read as 3 — the bracket silently closed').not.toBe(3);

    expect(r.closedGroup.val, 'a CLOSED group still resolves').toBe(3);
    expect(r.closedNested.val).toBe(3);
    expect(r.closedCall.val).toBe(7);
    expect(r.closedAtanSlash.val, 'the Fanuc ATAN[a]/[b] form still works').toBe(45);
    expect(r.closedIndirect.val, 'indirect #[expr] still resolves').toBe(42);

    expect(r.s6a.val, 'S6a #191k8 — still refused (t1573 not undone)').toBeNull();
    expect(r.s6b.val, 'S6b [1 + 2 k 8] — still refused').toBeNull();
    expect(r.s6c.val, 'S6c a bare word — still refused').toBeNull();

    // ② S6g — the SECOND hardware ATAN value, and the one that pins argument ORDER. S5o's equal arguments
    // (ATAN[1, 1] → 4500) could not distinguish atan2(a, b) from atan2(b, a); S6g's unequal ones can:
    // the V4.1 read back 2656.505, which is atan2(1, 2) in degrees ×100 — first argument = y. Studio's
    // comma-form convention was an assumption until this number came off the machine.
    expect(r.s5o.val, 'S5o: ATAN[1, 1] * 100 is still the hardware\'s 4500').toBe(4500);
    expect(r.s6g.val, 'S6g: the V4.1 read 2656.505 — atan2(y=1, x=2), argument order CONFIRMED').toBeCloseTo(2656.505, 2);

    // ③ the separation: an unset variable is a VALUE question, not a syntax one — completely unaffected.
    expect(r.unset.val, 'preview: unresolvable value → null (unchanged)').toBeNull();
    expect(r.unset.engine, 'engine: uninitialised reads 0, emulating the controller (unchanged)').toBe(0);
    expect(r.unset.valid, 'an unset variable is SYNTACTICALLY valid').toBe(true);
});

test('ZERO goldens move: every shipped twin\'s default emit still passes the tightened parser', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef, undefined, { timeout: 20_000 });

    // No shipped twin contains an unclosed bracket, so this tightening may not reject a single emitted line.
    // The emit path itself uses the WIZARD evaluator (wizards/ops/expr.js), a separate language — so the emits
    // cannot change bytes; what CAN change is whether the tightened sim/gate parser still ACCEPTS them. Sweep
    // the whole registry: default params → emit → defaultSyntaxVerify, and name any wizard that fails.
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
        const rows = [];
        for (const s of U.listUserOps()) {
            let verdict;
            try {
                const gcode = String(emitProgram(U.instantiate(s, { ...U.defaultParams(s) })));
                const syn = GcodeExecutionEngine.defaultSyntaxVerify(gcode);
                verdict = { opType: s.opType, valid: syn.valid, badLines: (syn.errors || []).map((e) => `L${e.lineIndex + 1}: ${String(e.line || '').trim()}`).slice(0, 3) };
            } catch (e) {
                verdict = { opType: s.opType, valid: null, badLines: [String((e && e.message) || e)] };
            }
            rows.push(verdict);
        }
        return rows;
    });

    expect(r.length, 'the sweep actually enumerated the registry').toBeGreaterThan(20);

    // ⚠ ONE PRE-EXISTING FALSE REFUSAL, exposed by this sweep and NOT caused by t1601 — pinned so it shrinks
    // visibly, the same way the gate spec once pinned the unclosed-bracket leniency. `user_lathe_odturn`
    // emits `#137=[0-[#125*[#120-#122]/[#128-#122]]]`: validateExpression's dummy vars all read 1, so the
    // denominator [#128-#122] evaluates to 0 and the division "fails" — a VALUE artefact of validation
    // answering a SYNTAX question, which its own dummy-read-as-1 comment exists to prevent and cannot for a
    // difference of two vars. VERIFIED PRE-EXISTING against expression.js@HEAD (pre-t1601): the same line was
    // already invalid — so the shipped send gate (t1585) would falsely refuse a lathe OD-turn program TODAY.
    // Reported to the advisor as its own defect; a decision is owed there, not silently absorbed here.
    const KNOWN_FALSE_REFUSAL = ['user_lathe_odturn'];
    const rejected = r.filter((x) => x.valid !== true);
    expect(rejected.map((x) => x.opType).sort(),
        'the TIGHTENING may reject nothing new — only the pre-existing division-by-zero false refusal, pinned by name').toEqual(KNOWN_FALSE_REFUSAL);
    expect(rejected[0].badLines.join(' '),
        'and it fails on the KNOWN line for the KNOWN reason (division under dummy-1s) — not an unclosed bracket').toContain('#137=');
});
