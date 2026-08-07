import { test, expect } from '@playwright/test';

/**
 * t1577 — A SET BLOCK PROPAGATES ITS FAILURE INSTEAD OF SUBSTITUTING 0.
 *
 * t1575 stopped the emit laundering a broken coordinate. A Set block reproduced that very bug ONE HOP UPSTREAM:
 *     w = widht / 2   ->   ( w = 0 )        the Set laundered it
 *     G0 Xw           ->   G0 X0           downstream read 0 and we were back where we started
 * so for anyone using Set blocks, t1575 had not landed at all.
 *
 * ⚠ WHY THE FIX IS DIFFERENT FROM THE COORDINATE CASE. A coordinate has a machine-side line that can carry the
 * error. A Set value does NOT — Studio consumes it before any G-code exists — so "emit verbatim" does not
 * transfer. What transfers is the principle: PROPAGATE THE FAILURE, NEVER SUBSTITUTE A PLAUSIBLE VALUE. The name
 * stays bound (it WAS declared — this is not an unknown variable) but bound to the UNRESOLVED sentinel, so every
 * expression that reads it fails, and the failure surfaces at the CONSUMING line, which emits verbatim. That
 * turns an invisible poison into the visible case already solved.
 *
 * The chained case is the one that proves it is propagation rather than a special case: `h = w * 2` inherits the
 * failure from `w` and passes it on again, so the error still arrives at the line that finally uses `h`.
 */
test('a broken Set value reaches the machine at the CONSUMING line, not as X0', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const BE = await import('/blocks/blockEmitter.js');
        const { lintProgram } = await import('/blocks/lint.js');
        const run = (stack) => ({ emit: String(BE.emitProgram(stack, {})), lint: lintProgram(stack).map((w) => w.msg) });
        const mv = (x) => ({ id: 'm', type: 'move', params: { mode: 'rapid', x, y: 1, z: -1, feed: 100 } });
        return {
            broken: run([{ id: 's', type: 'set', params: { name: 'w', value: 'widht / 2' } }, mv('w')]),
            ok: run([{ id: 's', type: 'set', params: { name: 'w', value: '10 + 5' } }, mv('w')]),
            chained: run([
                { id: 's', type: 'set', params: { name: 'w', value: 'widht / 2' } },
                { id: 's2', type: 'set', params: { name: 'h', value: 'w * 2' } },
                mv('h'),
            ]),
            runtimeVar: run([{ id: 's', type: 'set', params: { name: 'w', value: '#500' } }, mv('w')]),
        };
    });

    // ① the consuming line carries it — NOT a laundered zero
    expect(r.broken.emit, 'the line that USES the broken binding emits verbatim').toContain('G0 Xw');
    expect(r.broken.emit, 'and must never be the legal-but-wrong move to zero').not.toMatch(/X0(\s|$)/);
    expect(r.broken.emit, 'the Set comment shows the author\'s TEXT, not a number never computed').toContain('( w = widht / 2 )');
    expect(r.broken.emit, 'nothing may reach the file as NaN').not.toContain('NaN');

    // ② the lint names BOTH ends: the root cause, and the line that inherits it
    const bl = r.broken.lint.join(' | ');
    expect(bl, 'the Set block names the root cause').toContain('widht');
    expect(bl, 'and the consuming line says the binding did not resolve').toContain('w did not resolve');

    // ③ PROPAGATION, not a special case — the failure survives a second hop
    expect(r.chained.emit, 'h inherits w\'s failure and the final line carries it').toContain('G0 Xh');
    expect(r.chained.emit).not.toMatch(/X0(\s|$)/);
    expect(r.chained.lint.join(' | '), 'and the chain is traceable in the warnings').toContain('h did not resolve');

    // ④ a WORKING Set is completely unaffected
    expect(r.ok.emit, 'a resolvable binding still computes').toContain('( w = 15 )');
    expect(r.ok.emit).toContain('G0 X15');
    expect(r.ok.lint, 'and says nothing').toEqual([]);

    // ⑤ ⚠ AN HONEST LIMIT, PINNED SO IT IS NOT MISTAKEN FOR SUCCESS. Binding a CONTROLLER TOKEN through a Set
    //    (`w = #500`) is NOT carried through to the consuming line as `X#500`. Studio's evaluator cannot read
    //    `#500` — that is the machine's namespace — so the binding is treated as unresolved like any other, and
    //    the consumer emits `Xw`. This is not a regression: before t1577 the same case emitted `X0`, silently
    //    wrong. It is now loudly wrong instead, which is better but is NOT the "runtime values keep working"
    //    guarantee that holds for a #var written DIRECTLY into a coordinate (see t1575, still true). Carrying a
    //    token through a Set binding would need textual substitution at the consumer — a separate act.
    expect(r.runtimeVar.emit, 'the Set comment shows the token the author wrote').toContain('( w = #500 )');
    expect(r.runtimeVar.emit, 'but the consumer emits the NAME, not the token — the limit above').toContain('G0 Xw');
    expect(r.runtimeVar.emit, 'what matters is that it is no longer the silent zero').not.toMatch(/X0(\s|$)/);
});
