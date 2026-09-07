import { test, expect } from './support/harness.mjs';

/**
 * t1583 — THE SIM LEARNS THE COMMA, because the send gate is about to be built on the parser.
 *
 * t1573 made the sim reject what the machine rejects, and recorded a divergence in the OPPOSITE direction: the
 * sim REJECTED `ATAN[1, 1]`, which the hardware ACCEPTS. Bench probe `S5o` ran `#190 = ATAN[1, 1] * 100` on the
 * V4.1 and read back **4500** — 45 DEGREES, not radians and not a 0-1 fraction. That number came off the machine.
 *
 * Why it had to land BEFORE the send gate: the gate refuses what the parser refuses. A parser stricter than the
 * controller would have made the gate block a legitimate job on day one. A false warning is a nuisance; a false
 * REFUSAL on the send path stops real work.
 *
 * ⚠ AND IT MUST NOT REINTRODUCE THE LENIENCY t1573 REMOVED. The comma is a token ONLY so a call can separate its
 * arguments; it is given no meaning anywhere else in the grammar. The second half of this spec is therefore the
 * important half — every malformed form the hardware refused must STILL be refused, and a comma outside a
 * function call must be as fatal as any other stray token.
 */
test('ATAN[a, b] resolves in DEGREES, and nothing else became lenient', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const { evalExpr, validateExpression } = await import('/engine/core/expression.js');
        const vars = new Map([[191, 42], [52, 1], [53, 1]]);
        const ev = (s) => ({ val: evalExpr(s, vars), valid: validateExpression(s), engine: evalExpr(s, vars, { unsetValue: 0 }) });
        return {
            hardware: ev('ATAN[1, 1] * 100'),      // S5o, transcribed from the controller
            plain: ev('ATAN[1, 1]'),
            noSpace: ev('ATAN[1,1]'),
            fromVars: ev('ATAN[#52, #53]'),
            quadrant: ev('ATAN[-1, 1]'),
            slash: ev('ATAN[1]/[1]'),              // the Fanuc form — UNTESTED on hardware, so deliberately kept
            single: ev('ATAN[1]'),
            bareComma: ev('1, 2'),
            bracketComma: ev('[1, 2]'),
            wrongArity: ev('ABS[1, 2]'),
            emptyArg: ev('ATAN[1, ]'),
            unclosedCall: ev('ATAN[1, 1'),
            s6a: ev('#191k8'), s6b: ev('[1 + 2 k 8]'), s6c: ev('widht'),
            ok: ev('#191 * 2'),
            unset: ev('#500'),
        };
    });

    // ① THE HARDWARE NUMBER — the whole reason this shape is supported at all.
    expect(r.hardware.val, 'S5o: the V4.1 ran ATAN[1, 1] * 100 and read back 4500').toBe(4500);
    expect(r.plain.val, 'so ATAN[1, 1] is 45 — DEGREES').toBe(45);
    expect(r.noSpace.val, 'whitespace around the comma is irrelevant').toBe(45);
    expect(r.fromVars.val, 'and the arguments are full expressions, not just literals').toBe(45);
    expect(r.quadrant.val, 'two-argument ATAN is quadrant-correct (atan2), not a plain ratio').toBe(-45);

    // ② the existing forms are untouched. The slash form has NO hardware verdict either way, so removing it on a
    //    hunch would be exactly the guessing this arc has avoided.
    expect(r.slash.val, 'the Fanuc ATAN[a]/[b] form still works').toBe(45);
    expect(r.single.val, 'and the single-argument form').toBe(45);
    expect(r.ok.val, 'ordinary arithmetic is unaffected').toBe(84);

    // ③ ⚠ NO LENIENCY REINTRODUCED — the half that matters. A comma has meaning ONLY between call arguments.
    expect(r.bareComma.val, 'a bare comma expression is not an expression').toBeNull();
    expect(r.bracketComma.val, 'a comma inside brackets that are NOT a call is still fatal').toBeNull();
    expect(r.wrongArity.val, 'only ATAN takes two arguments — a comma elsewhere is an arity error').toBeNull();
    expect(r.emptyArg.val, 'a missing second argument is not an implicit anything').toBeNull();
    expect(r.unclosedCall.val, 'and the closing bracket is required — no partial parse').toBeNull();
    for (const k of ['bareComma', 'bracketComma', 'wrongArity', 'emptyArg', 'unclosedCall']) {
        expect(r[k].valid, `${k}: validateExpression must agree`).toBe(false);
    }

    // ④ the three forms the V4.1 REFUSED still refuse (t1573 must not have been undone)
    expect(r.s6a.val, 'S6a #191k8').toBeNull();
    expect(r.s6b.val, 'S6b [1 + 2 k 8]').toBeNull();
    expect(r.s6c.val, 'S6c a bare word').toBeNull();

    // ⑤ and the VALUE/syntax separation still holds: an unset variable is syntactically fine.
    expect(r.unset.val, 'preview: unresolvable value → null').toBeNull();
    expect(r.unset.engine, 'engine: uninitialised reads 0, emulating the controller').toBe(0);
    expect(r.unset.valid, 'and it is not a SYNTAX error').toBe(true);
});
