import { test, expect } from './support/harness.mjs';

/**
 * t1579 — AN UNRESOLVABLE LOOP / STEP-DOWN BOUND EMITS THE AUTHOR'S TEXT INSTEAD OF GUESSING.
 *
 * The last case in the arc, and the one where the earlier fixes do not transfer. A coordinate carries its
 * failure to the machine by emitting the author's text (t1575); a Set value carries it downstream to the line
 * that uses it (t1577). A BOUND can do neither — Studio consumes it to decide how many times to unroll, and the
 * iterations that would have carried the error are exactly what fails to exist.
 *
 * MEASURED, and the two do NOT misbehave the same way — which is why "very likely the same defect" was not good
 * enough to act on:
 *     COUNT      to='nosuch'  ->  fallback 0  ->  ZERO iterations  ->  the operation VANISHES from the file
 *     STEP DOWN  to='nosuch'  ->  fallback 5  ->  FIVE levels      ->  it CUTS to a depth nobody specified
 * Both are Studio silently deciding what the author meant. The Step Down one emits real motion, so it is worse.
 *
 * Unrolling once with the failure in scope was REJECTED on safety: body lines that never reference the index
 * would emit real motion, and because execution is PARTIAL (hardware probe S6e) those lines CUT before the
 * machine ever reached the refusal. A silently-dropped operation is bad; cutting something unrequested is worse.
 *
 * So the bound emits the author's OWN text as a line of its own, in place of the body — the same transformation
 * as the coordinate case, placed where the machine reads it. Deliberately NOT `#100=nosuch`: authoring a
 * controller-variable write would be a side effect no one asked for.
 */
const body = [{ id: 'k', type: 'move', params: { mode: 'rapid', x: 1, y: 1, z: -1, feed: 100 } }];
const loop = (p) => ([{ id: 'l', type: 'count', params: { var: 'i', from: '1', to: '3', by: '1', ...p }, children: body }]);
const depth = (p) => ([{ id: 'd', type: 'stepdown', params: { to: '3', by: '1', ...p }, children: body }]);

test('a broken bound refuses with the author\'s text; a working one is untouched', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async (stacks) => {
        const BE = await import('/blocks/blockEmitter.js');
        const { lintProgram } = await import('/blocks/lint.js');
        const out = {};
        for (const [k, s] of Object.entries(stacks)) out[k] = { emit: String(BE.emitProgram(s, {})), lint: lintProgram(s) };
        return out;
    }, {
        loopBad: loop({ to: 'nosuch' }), depthBad: depth({ to: 'nosuch' }),
        loopOk: loop({}), depthOk: depth({}),
        loopToken: loop({ to: '#100' }),
    });

    // ① the author's text reaches the file, and the body does NOT
    expect(r.loopBad.emit, 'the bound the author wrote is the line the machine will refuse').toContain('nosuch');
    expect(r.loopBad.emit, 'and the body must not be unrolled — those lines would CUT before the refusal').not.toContain('G0 X1');
    expect(r.depthBad.emit).toContain('nosuch');
    expect(r.depthBad.emit).not.toContain('G0 X1');

    // ② ⚠ THE STEP-DOWN REGRESSION THIS CLOSES: it used to invent five levels from a fallback of 5.
    expect(r.depthBad.emit, 'Step Down must not cut to a depth nobody specified').not.toContain('z=-5');
    expect((r.depthBad.emit.match(/Step Down z=/g) || []).length, 'no invented depth levels at all').toBe(0);

    // ③ nothing is FABRICATED — no controller-variable write, no token no author wrote
    expect(r.loopBad.emit, 'never author a #var assignment as a side effect').not.toMatch(/#\d+\s*=/);
    expect(r.depthBad.emit).not.toMatch(/#\d+\s*=/);

    // ④ a WORKING bound is completely unaffected
    expect(r.loopOk.emit, 'a resolvable loop still unrolls').toContain('( Count i=2 )');
    expect(r.loopOk.lint, 'and says nothing').toEqual([]);
    expect(r.depthOk.emit, 'a resolvable depth walk still builds').toContain('( Step Down z=-3 )');
    expect(r.depthOk.lint).toEqual([]);

    // ⑤ the lint reports it ONCE, at ERROR, saying what actually happens
    const rows = r.loopBad.lint.filter((w) => w.kind === 'unresolvable-expr');
    expect(rows.length, 'ONE row for one typo — not one per reporter').toBe(1);
    expect(rows[0].severity, 'a file the controller will refuse is an error about the file').toBe('error');
    expect(rows[0].msg, 'and it names the bound and the cause').toContain('nosuch');
    expect(r.loopBad.lint.map((w) => w.msg).join(' | '), 'the stale "runs 0 times" consequence is gone').not.toContain('runs 0 times');

    // ⑥ ⚠ STEP DOWN IS REPORTED AT ALL — t1577's routing had silenced it (lint has no depth branch)
    const dRows = r.depthBad.lint.filter((w) => w.kind === 'unresolvable-expr');
    expect(dRows.length, 'a Step Down bound must be reported, not silently routed to nobody').toBe(1);
    expect(dRows[0].severity).toBe('error');

    // ⑦ ⚠ AN HONEST LIMIT: a CONTROLLER TOKEN bound is a RUNTIME value, not a malformed program. Studio cannot
    //    unroll it at build time, so it keeps its existing (silent, zero-iteration) behaviour rather than being
    //    accused of being broken. Pinned so the carve-out is not mistaken for a fix.
    expect(r.loopToken.emit, 'a #var bound is not treated as malformed').not.toContain('#100\n');
    expect(r.loopToken.lint.filter((w) => w.kind === 'unresolvable-expr'), 'and is not reported as an error').toEqual([]);
});
