import { test, expect } from '@playwright/test';

/**
 * t1581 — IF CONDITIONS: the last member of the family, and the worst.
 *
 * `resolveBool` caught to `false`, so an unresolvable condition SILENTLY took the else-branch:
 *     IF  depth > 5   ->  roughing pass
 *     IF  dpeth > 5   ->  the else-branch, forever, with no warning anywhere
 * A bound at least fails toward EMPTINESS, which a person might notice. Here both branches are plausible
 * complete programs: the file looks right, runs clean, cuts the wrong thing, and nothing says why. The lint was
 * silent too — `cond`'s default is a string (a boolean socket), so the numeric-default discriminator skipped it.
 *
 * ⚠ TWO CONDITIONALS EXIST AND THEY TAKE DIFFERENT PRECEDENTS. Determined, not assumed:
 *   - `if` (iff.js, kind:'cond') is UNROLLED — Studio consumes the condition and only the taken branch reaches
 *     the G-code. Loop-bound precedent: a refusal line carrying the author's text, NEITHER branch emitted, ERROR.
 *   - `ifgoto` (flow.js) emits a REAL controller `IF … GOTO` — the branch survives into the file and the MACHINE
 *     reads it. Coordinate precedent: emit the author's text and let the controller refuse the line.
 *
 * Within `ifgoto` the operands already rode out verbatim (interpolated as strings, so t1575's collapse carried
 * them), but the LABEL did not: `num(p.goto, 1)` turned an unresolvable jump target into `GOTO1` — a silent jump
 * to a real but WRONG label — while the lint announced "emitted as written" about it, which was false.
 */
const body = [{ id: 'k', type: 'move', params: { mode: 'rapid', x: 1, y: 1, z: -1, feed: 100 } }];
const iff = (cond) => ([{ id: 'i', type: 'if', params: { cond }, children: body }]);
const jump = (p) => ([{ id: 'g', type: 'ifgoto', params: { lhs: '#1920', op: '!=', rhs: '2', goto: 1, ...p } }]);

test('an unresolvable IF refuses instead of silently choosing a branch', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async (stacks) => {
        const BE = await import('/blocks/blockEmitter.js');
        const { lintProgram } = await import('/blocks/lint.js');
        const out = {};
        for (const [k, s] of Object.entries(stacks)) out[k] = { emit: String(BE.emitProgram(s, {})), lint: lintProgram(s) };
        return out;
    }, {
        broken: iff('dpeth > 5'), t: iff('1'), f: iff('0'), empty: iff(''), token: iff('#1920'),
        badLabel: jump({ goto: 'nosuch' }), badRhs: jump({ rhs: 'dpeth' }), okJump: jump({}),
    });

    // ── ① THE UNROLLED IF: the author's text, and NEITHER branch ────────────────────────────────────────
    expect(r.broken.emit, 'the condition the author wrote is what the machine will refuse').toContain('dpeth > 5');
    expect(r.broken.emit, 'and the body must NOT be emitted — choosing a branch we could not read is the defect').not.toContain('G0 X1');
    expect(r.broken.emit, 'nor may it quietly report itself as false').not.toContain('If false');

    const bl = r.broken.lint.filter((w) => w.kind === 'unresolvable-expr');
    expect(bl.length, 'the condition is reported — it used to say NOTHING at all').toBe(1);
    expect(bl[0].severity, 'a file the controller will refuse is an error about the file').toBe('error');
    expect(bl[0].msg, 'naming the identifier').toContain('dpeth');

    // ── ② a WORKING condition is untouched, both ways, including the declared empty = false ─────────────
    expect(r.t.emit, 'a true condition still runs the body').toContain('G0 X1');
    expect(r.t.lint, 'and says nothing').toEqual([]);
    expect(r.f.emit, 'a false condition still skips it').toContain('If false');
    expect(r.f.emit).not.toContain('G0 X1');
    expect(r.f.lint).toEqual([]);
    expect(r.empty.emit, 'empty condition = false is DECLARED behaviour, not a failure').toContain('If false');
    expect(r.empty.lint, 'and must not be reported as broken').toEqual([]);

    // ── ③ ⚠ the RUNTIME carve-out, held for the fourth act running ──────────────────────────────────────
    expect(r.token.lint.filter((w) => w.kind === 'unresolvable-expr'), 'a #var condition is a runtime value, not a malformed program').toEqual([]);

    // ── ④ THE CONTROLLER IF: the label rides out as written, so the machine refuses the JUMP ────────────
    expect(r.badLabel.emit, 'an unresolvable jump target is the author\'s text').toContain('GOTOnosuch');
    expect(r.badLabel.emit, 'and must NOT silently become a real but wrong label').not.toContain('GOTO1');
    const jl = r.badLabel.lint.filter((w) => w.kind === 'unresolvable-expr');
    expect(jl.length, 'reported once').toBe(1);
    expect(jl[0].msg, 'and the message is now TRUE — it really is emitted as written').toContain('emitted as written');

    // ── ⑤ the operands already carried the author's text; pinned so it cannot regress ───────────────────
    expect(r.badRhs.emit, 'a broken comparison operand rides out verbatim').toContain('#1920!=dpeth');
    expect(r.okJump.emit, 'and a working jump is completely unchanged').toBe('IF #1920!=2 GOTO1');
});
