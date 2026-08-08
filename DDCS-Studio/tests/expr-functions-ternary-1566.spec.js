import { test, expect } from '@playwright/test';

/**
 * t1566 — the evaluator's declared surface: min / max / abs / round + a ternary.
 *
 * Extends `wizards/ops/expr.js`, the ONE wizard-side evaluator (t1564's survey found it already at ~80%
 * and ruled out building a rival). Landed AFTER the lint-surfacing commit on purpose: every new function
 * is a new way to typo an identifier, so widening the mouth before fixing the silence would have added
 * silent-failure surface.
 *
 * The error cases are pinned as hard as the happy ones — a bad expression must produce a NAMED throw
 * (which lint turns into a block-tagged warning), never a wrong number.
 */
test('min/max/abs/round + ternary evaluate; every malformed form throws a NAMED error', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const { evalExpr, EXPR_FUNCTIONS } = await import('/wizards/ops/expr.js');
        const ev = (src, scope = {}) => { try { return { v: evalExpr(src, scope) }; } catch (e) { return { err: e.message }; } };
        const scope = { w: 10, h: 4, zero: 0 };
        return {
            functions: EXPR_FUNCTIONS,
            // happy paths
            abs: ev('abs(0 - 7)'), round: ev('round(2.6)'), min: ev('min(3, 9)'), max: ev('max(3, 9)'),
            minN: ev('min(5, 2, 8)'), nested: ev('max(abs(0 - 3), min(w, h))', scope),
            withVars: ev('round(w / 3)', scope),
            // ternary — truthiness is != 0 (the codebase's existing convention for expressions in bool position)
            tTrue: ev('w ? 1 : 2', scope), tFalse: ev('zero ? 1 : 2', scope),
            tArith: ev('w - 10 ? 100 : 200', scope),            // 0 -> else
            tRightAssoc: ev('0 ? 1 : 0 ? 2 : 3'),                // -> 3
            tInParens: ev('(1 ? 4 : 5) * 2'),
            tPrecedence: ev('1 + 1 ? 10 : 20'),                  // cond is (1+1)=2 -> 10
            // error paths, each must NAME the problem
            badFn: ev('sqr(4)'), wrongCase: ev('ABS(4)'),
            arity1: ev('abs(1, 2)'), arity2: ev('min(1)'),
            unknownVar: ev('fedrate * 2'), ternaryNoColon: ev('1 ? 2'),
            unclosedCall: ev('min(1, 2'), trailing: ev('abs(2) 5'),
            // the properties that must NOT regress
            divZero: ev('1/0'), plainMaths: ev('10 + 5'), select: ev('grid'),
        };
    });

    // t1613 — EXPECTATION GROWN WITH THE RULING (called out, not smuggled): `ceil` joined the declared table
    // for the derived `passes` field (ceil(depth/stepdown)), lowercase per the table's doctrine — the dedicated
    // passes-field spec asserts its behaviour + that CEIL still refuses by name. The pin's PURPOSE (the set is
    // one declared source, nothing sneaks in unlisted) is unchanged; the ruled member joins the list.
    expect(r.functions.sort(), 'the declared function set is the one source').toEqual(['abs', 'ceil', 'max', 'min', 'round']);

    expect(r.abs.v).toBe(7);
    expect(r.round.v).toBe(3);
    expect(r.min.v).toBe(3);
    expect(r.max.v).toBe(9);
    expect(r.minN.v, 'min/max are variadic').toBe(2);
    expect(r.nested.v, 'calls nest, and read the scope').toBe(4);
    expect(r.withVars.v).toBe(3);

    expect(r.tTrue.v).toBe(1);
    expect(r.tFalse.v, 'a zero condition selects the else branch').toBe(2);
    expect(r.tArith.v, 'the condition is a full expression, truthy when != 0').toBe(200);
    expect(r.tRightAssoc.v, 'a ? b : c ? d : e  ==  a ? b : (c ? d : e)').toBe(3);
    expect(r.tInParens.v).toBe(8);
    expect(r.tPrecedence.v, 'ternary binds looser than arithmetic').toBe(10);

    // Errors NAME the cause — this is what lint surfaces to the author.
    expect(r.badFn.err, 'a typo\'d function names itself AND the known set').toContain('sqr');
    expect(r.badFn.err).toContain('abs');
    expect(r.wrongCase.err, 'the DDCS macro spelling is not this language').toContain('ABS');
    expect(r.arity1.err, 'too many args is named').toContain('abs');
    expect(r.arity2.err, 'too few args is named').toContain('min');
    expect(r.unknownVar.err).toContain('fedrate');
    expect(r.ternaryNoColon.err).toContain(':');
    expect(r.unclosedCall.err, 'an unclosed call is a parse error, not a silent value').toBeTruthy();
    expect(r.trailing.err, 'trailing input still rejected').toContain('trailing');

    // Unchanged guarantees from before the extension.
    expect(r.divZero.err, 'non-finite stays an error, never a poison number').toBeTruthy();
    expect(r.plainMaths.v, 'plain arithmetic is untouched').toBe(15);
    expect(r.select.err, 'a select still throws so callers keep the raw value').toContain('unknown var');
});
