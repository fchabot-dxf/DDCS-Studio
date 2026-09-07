import { test, expect } from './support/harness.mjs';

/**
 * t1573 — THE SIM MUST REJECT WHAT THE MACHINE REJECTS. Hardware-grounded, not invented.
 *
 * Five probes were run on the bench V4.1 (see bridge/controllers/v4.1/FINDINGS.md, 2026-08-07). Three
 * malformed forms were REFUSED by the controller with an on-screen `Unrecognized file format` naming the exact
 * line. Studio's sim evaluator parsed each as far as it could and silently DROPPED the remainder, so `#191k8`
 * read as `#191` and `[1 + 2 k 8]` read as `3` — a clean-looking preview for a file the machine will not run.
 * That is the sim lying in the most dangerous direction: "everything is fine".
 *
 * And a refused program is NOT inert. Probe S6e proved execution is PARTIAL: every line before the fault runs,
 * then the machine halts. So a typo in op 5 means ops 1-4 cut for real, with the tool stopping in the material.
 *
 * ⚠ THE SEPARATION THIS SPEC EXISTS TO PROTECT: this is about MALFORMED SYNTAX, never about UNKNOWN VALUES. An
 * unset `#500` legitimately reads as 0 on the execution engine and null in the preview, and that behaviour is
 * CORRECT. The trailing-token check is a single top-level question ("did the grammar consume every token"); the
 * unset path lives inside the `#` branch. The last case below pins that they stay apart, because blurring them
 * would break the engine's deliberate DDCS-emulation semantics.
 */

// The exact strings the controller rejected, transcribed from its screen. `line` is what the V4.1 printed.
const REJECTED = [
    { probe: 'S6a', line: '#190 = #191k8', expr: '#191k8', wasSilently: 42, error: 'Unrecognized file format: L11[#190 = #191k8]' },
    { probe: 'S6b', line: '#190 = [1 + 2 k 8]', expr: '[1 + 2 k 8]', wasSilently: 3, error: 'Unrecognized file format: L9[#190 = [1 + 2 k 8]]' },
    { probe: 'S6c', line: 'G04 Pwidht', expr: 'widht', wasSilently: null, error: 'Unrecognized file format: L29[G04 Pwidht]' },
];

test('the three forms the V4.1 REFUSED are unresolvable in the sim, not silently truncated', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async (cases) => {
        const { evalExpr, validateExpression } = await import('/engine/core/expression.js');
        const vars = new Map([[191, 42]]);
        return cases.map((c) => ({
            probe: c.probe,
            expr: c.expr,
            preview: evalExpr(c.expr, vars),                        // null = unresolvable (preview skips the move)
            engine: evalExpr(c.expr, vars, { unsetValue: 0 }),      // the DDCS-emulator reading
            valid: validateExpression(c.expr),
        }));
    }, REJECTED);

    for (const got of r) {
        const c = REJECTED.find((x) => x.probe === got.probe);
        expect(got.preview, `${c.probe} — the machine answered "${c.error}"; the preview must not produce a number`).toBeNull();
        expect(got.engine, `${c.probe} — and neither may the execution-engine reading`).toBeNull();
        expect(got.valid, `${c.probe} — validateExpression must call it invalid`).toBe(false);
    }

    // The regression this replaces, stated as the values the parser used to invent.
    expect(r.find((x) => x.probe === 'S6a').preview, 'S6a used to read as 42 (the #191 prefix, rest dropped)').not.toBe(42);
    expect(r.find((x) => x.probe === 'S6b').preview, 'S6b used to read as 3 (the [1+2 prefix, rest dropped)').not.toBe(3);
});

test('well-formed expressions are untouched, and UNKNOWN VALUE stays a separate, correct concern', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const { evalExpr, validateExpression } = await import('/engine/core/expression.js');
        const vars = new Map([[191, 42], [52, 1], [53, 1]]);
        const ev = (s, o) => evalExpr(s, vars, o);
        return {
            direct: ev('#191'), maths: ev('[1 + 2]'), mixed: ev('#191 * 2'),
            nested: ev('#191 - [1 + 1]'), indirect: ev('#[190 + 1]'),
            atanTwoBracket: ev('ATAN[1]/[1]'), absFn: ev('ABS[0 - 7]'), sqrtFn: ev('SQRT[9]'),
            validOk: validateExpression('#191 * 2'),
            // ⚠ UNSET VARIABLE — a VALUE question, not a syntax one. Must be completely unaffected.
            unsetPreview: ev('#500'),                    // null: preview skips a move it cannot resolve
            unsetEngine: ev('#500', { unsetValue: 0 }),  // 0: the real controller reads uninitialised as 0
            unsetInMaths: ev('#500 + 5', { unsetValue: 0 }),
            unsetValid: validateExpression('#500'),      // syntactically fine — it is only the VALUE that is missing
        };
    });

    expect(r.direct).toBe(42);
    expect(r.maths).toBe(3);
    expect(r.mixed).toBe(84);
    expect(r.nested).toBe(40);
    expect(r.indirect, 'indirect #[expr] still resolves').toBe(42);
    expect(r.atanTwoBracket, 'the bracketed two-operand ATAN is quadrant-correct degrees').toBe(45);
    expect(r.absFn).toBe(7);
    expect(r.sqrtFn).toBe(3);
    expect(r.validOk).toBe(true);

    // THE SEPARATION — an unset variable is not malformed syntax and must keep its declared readings.
    expect(r.unsetPreview, 'preview: unresolvable VALUE → null (unchanged)').toBeNull();
    expect(r.unsetEngine, 'engine: uninitialised reads 0, emulating the controller (unchanged)').toBe(0);
    expect(r.unsetInMaths, 'and it still participates in arithmetic under that reading').toBe(5);
    expect(r.unsetValid, 'an unset variable is SYNTACTICALLY valid — only its value is missing').toBe(true);
});
