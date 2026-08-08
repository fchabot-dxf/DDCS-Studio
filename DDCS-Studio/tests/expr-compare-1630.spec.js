import { test, expect } from '@playwright/test';

/**
 * t1630 — COMPARISON PREDICATES: the deliberate widening t1566 deferred, ruled in.
 *
 * `<  >  <=  >=  ==  !=` as expression operators — SYMBOLS ONLY, yielding 1/0 as VALUES. A comparison is
 * an expression result, never a branch: guard blocks keep owning control flow. Conventional precedence
 * (relational tighter than equality; both between the ternary and arithmetic), so `a < b ? x : y` composes
 * on the ternary's existing ≠0-truthy convention. A bare `=` or misplaced `!` is a NAMED error pointing
 * at `==` / `!=` — the same lint-facing discipline every other malformed form has.
 */
test('comparisons evaluate to 1/0, compose with arithmetic + the ternary, and misuse is NAMED', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const { evalExpr } = await import('/wizards/ops/expr.js');
        const ev = (src, scope = {}) => { try { return { v: evalExpr(src, scope) }; } catch (e) { return { err: e.message }; } };
        const scope = { w: 10, h: 4 };
        return {
            // the six operators, both outcomes each
            lt1: ev('2 < 3'), lt0: ev('3 < 2'),
            gt1: ev('3 > 2'), gt0: ev('2 > 3'),
            le1: ev('2 <= 2'), le0: ev('3 <= 2'),
            ge1: ev('2 >= 2'), ge0: ev('2 >= 3'),
            eq1: ev('4 == 4'), eq0: ev('4 == 5'),
            ne1: ev('4 != 5'), ne0: ev('4 != 4'),
            // precedence: arithmetic binds tighter than relational, relational tighter than equality,
            // and the ternary sits loosest — the conventional ladder
            arith: ev('2 + 1 < 4'),                    // (2+1) < 4 → 1
            relVsEq: ev('1 < 2 == 1'),                 // (1<2) == 1 → 1
            ternCompose: ev('w > h ? 100 : 200', scope),   // the t1566 header's promised composition
            ternElse: ev('w < h ? 100 : 200', scope),
            // 1/0 are VALUES — they add, multiply, and feed functions like any number
            asValues: ev('(w > h) + (h > w)', scope),  // 1 + 0
            inCall: ev('max(w > h, 5)', scope),        // max(1, 5)
            // chaining is left-associative (documented, like C): (3>2)=1, then 1>0 → 1
            chain: ev('3 > 2 > 0'),
            withVars: ev('w != h', scope),
            // misuse NAMES the fix
            singleEq: ev('5 = 5'),
            bareBangMid: ev('5 ! 3'),
            // the standing guarantees hold: a select-ish word still throws (callers keep the raw value)
            select: ev('grid'),
            trailing: ev('abs(2) 5'),
        };
    });

    for (const [k, want] of Object.entries({ lt1: 1, lt0: 0, gt1: 1, gt0: 0, le1: 1, le0: 0, ge1: 1, ge0: 0, eq1: 1, eq0: 0, ne1: 1, ne0: 0 })) {
        expect(r[k].v, `${k} yields ${want}`).toBe(want);
    }
    expect(r.arith.v, 'arithmetic binds tighter than a comparison').toBe(1);
    expect(r.relVsEq.v, 'relational binds tighter than equality').toBe(1);
    expect(r.ternCompose.v, 'a comparison drives the ternary via the existing ≠0-truthy rule').toBe(100);
    expect(r.ternElse.v).toBe(200);
    expect(r.asValues.v, 'comparison results are plain 1/0 VALUES — they participate in arithmetic').toBe(1);
    expect(r.inCall.v, '…and in function calls').toBe(5);
    expect(r.chain.v, 'chains are left-associative (documented)').toBe(1);
    expect(r.withVars.v).toBe(1);
    expect(r.singleEq.err, 'a single = names == as the fix').toContain('==');
    expect(r.bareBangMid.err, 'a bare ! names != as the fix').toContain('!=');
    expect(r.select.err, 'a bare word still throws — callers keep raw values, selects stay selects').toContain('unknown var');
    expect(r.trailing.err, 'trailing input is still rejected').toContain('trailing');
});
