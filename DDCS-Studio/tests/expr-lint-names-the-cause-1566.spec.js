import { test, expect } from '@playwright/test';

/**
 * t1566 — A BROKEN EXPRESSION MUST NAME ITS CAUSE, and a clean program must stay QUIET.
 *
 * t1564 surveyed the expression path and found the defect was not danger but SILENCE: `evalExpr` throws a
 * named error ("unknown var: fedrate") and three separate `catch` sites discarded it — `blockEmitter` 53/75 and
 * `lint` 17. Because a move coordinate's declared default IS 0, a typo'd parameter name silently emitted a real
 * `G0 X0`, indistinguishable from a deliberate zero.
 *
 * `lint.js` is the channel for this: it already runs the same `evalExpr` over the same scope and already tags
 * every warning with the producing block id. It reported the CONSEQUENCE ("depth 0 — nothing is cut") and never
 * the CAUSE. This pins both halves of the fix:
 *   - a broken expression on a value field produces a warning that NAMES the identifier/parse error;
 *   - a select ('rapid'), a controller token ('#7', '[#5+1]'), and a valid expression produce NOTHING.
 *
 * The quiet half is the one that matters long-term: `evalExpr` throws for selects BY DESIGN ("not an expression,
 * keep the raw value"), so a naive "warn on any throw" would fire on ~1172 params across the corpus and train
 * everyone to ignore the lint. Measured before the rule was written: of those 1172, 47 sit on numeric-defaulted
 * fields and ALL 47 are controller tokens — a clean corpus warns exactly 0 times.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('a broken expression names its cause; selects, controller tokens and valid maths stay silent', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const L = await import('/blocks/lint.js');
        const { lintProgram } = L;
        const msgs = (stack) => lintProgram(stack).map((w) => w.msg);
        return {
            // t1566 amendment — severity is a DECLARED slot, not a hardcoded literal
            vocab: L.LINT_SEVERITY,
            exprSeverityConst: L.UNRESOLVABLE_EXPR_SEVERITY,
            records: lintProgram([{ id: 'b0', type: 'move', params: { mode: 'rapid', x: 'fedrate * 2', y: 0, z: 0, feed: 500 } }]),
            unknownVar: msgs([{ id: 'b1', type: 'move', params: { mode: 'rapid', x: 'fedrate * 2', y: 0, z: 0, feed: 500 } }]),
            syntax: msgs([{ id: 'b2', type: 'move', params: { mode: 'rapid', x: '3 +', y: 0, z: 0, feed: 500 } }]),
            validMaths: msgs([{ id: 'b3', type: 'move', params: { mode: 'rapid', x: '10 + 5', y: 0, z: 0, feed: 500 } }]),
            controllerToken: msgs([{ id: 'b4', type: 'move', params: { mode: 'rapid', x: '#7', y: '[#5+1]', z: 0, feed: 500 } }]),
            setBlock: msgs([{ id: 'b5', type: 'set', params: { name: 'w', value: 'widht / 2' } }]),
        };
    });

    // ── the CAUSE is named ───────────────────────────────────────────────────────────────────────────────
    const unknown = r.unknownVar.join(' | ');
    expect(unknown, 'a typo\'d identifier must be named, not just its consequence').toContain('fedrate');
    expect(unknown, 'and the field it sits in').toContain('x');
    expect(r.syntax.join(' | '), 'a parse error must surface too').not.toEqual('');
    expect(r.syntax.length, 'a syntax error produces a warning').toBeGreaterThan(0);

    const setMsg = r.setBlock.join(' | ');
    expect(setMsg, 'the Set block already warned — now it must say WHICH identifier').toContain('widht');

    // ── and a clean program stays QUIET (the half that keeps the lint worth reading) ──────────────────────
    expect(r.validMaths, 'valid arithmetic warns about nothing').toEqual([]);
    expect(r.controllerToken, 'DDCS #vars / [expr] ride through to the controller — not ours to evaluate').toEqual([]);

    // ── the DECLARED severity slot (t1566 amendment) ─────────────────────────────────────────────────────
    // The run-time fork is ruled: an unresolvable expression will REFUSE to emit. Declaring the slot now
    // means that act flips ONE value; it does not retrofit a severity onto every call site and consumer.
    expect(r.vocab, 'the severity vocabulary is declared, not spelled out at each site').toEqual({ WARN: 'warn', ERROR: 'error' });
    // t1579 — THE FLIP THE SLOT WAS DECLARED FOR, and it cost exactly one line here, which was the point. When
    // t1566 added `severity` the value was WARN and the emit still laundered a broken expression into a plausible
    // default. It no longer does: the author's text goes out verbatim, the controller REFUSES the file by name
    // (bench-confirmed), and execution is PARTIAL — the ops before it cut, then the machine halts with the tool
    // in the material. That is an error about the FILE, not a warning about a preference. Had severity been
    // spelled out at each call site instead of declared once, this would have been a sweep across every reporter
    // and every consumer rather than one constant and this assertion.
    expect(r.exprSeverityConst, 'an unresolvable expression is an ERROR: the controller will refuse the file').toBe('error');
    expect(r.records.length, 'the broken expression produced a record to carry it').toBeGreaterThan(0);
    for (const rec of r.records) {
        // t1568 added `kind` as the second declared axis so a CONSUMER (the pre-flight badge) can select the
        // expression records without matching message text. Both axes are pinned here for the same reason the
        // severity slot was: a declared field that nothing asserts quietly rots back into a literal.
        expect(Object.keys(rec).sort(), 'every record carries blockId + msg + severity + kind').toEqual(['blockId', 'kind', 'msg', 'severity']);
        expect(rec.severity, 'and it is the declared value, not a literal').toBe('error');
        expect(rec.kind, 'an expression failure is declared as its own kind, distinct from motion-safety').toBe('unresolvable-expr');
    }
});
