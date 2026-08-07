import { test, expect } from '@playwright/test';

/**
 * t1575 — EMIT THE AUTHOR'S TEXT. Stop laundering a broken expression into a legal line.
 *
 * `X position = widht / 2` used to emit `G0 X0` — a perfectly legal line the machine runs happily, at the wrong
 * place, with the typo erased. The V4.1 bench run (2026-08-07) settled what the alternative is worth: the
 * controller REFUSES a line it cannot read, names it, and quotes it back (`Unrecognized file format: L11[…]`).
 * And refusal is not merely tidier — probe S6e proved execution is PARTIAL, so a laundered typo in op 5 means
 * ops 1-4 cut and the machine keeps going with a wrong coordinate, where a refusal stops it at the right line.
 *
 * ⚠ THE PREDICATE IS NARROW, and this spec exists mostly to pin the things that must NOT change:
 *   - MALFORMED SYNTAX or an UNDECLARED IDENTIFIER → verbatim. Studio KNOWS these are wrong; it holds the
 *     declared parameter list, and the expression already failed to parse.
 *   - An UNRESOLVABLE RUNTIME VALUE (`#500`, a probe result, `#1512` after an alignment) → UNCHANGED. These are
 *     unknowable at authoring time BY DESIGN and already ride out verbatim as controller tokens; the machine's
 *     read-as-0 is the correct semantic for them.
 *   - A WELL-FORMED expression → still computed. `10 + 5` is `X15`, not `X10 + 5`.
 *
 * ⚠ And the shape of the failure to watch for: a raw string reaching a numeric formatter (`toFixed`, rounding,
 * a unit conversion) lands as `XNaN` / `Xundefined` instead of `Xwidht`. The whole value of this change is that
 * the author's text survives INTACT as far as the controller's error message, so every case below asserts the
 * exact text and the last one sweeps the whole program for those two poison spellings.
 */
const mv = (x) => ([{ id: 'op1', type: 'move', params: { mode: 'rapid', x, y: 10, z: -5, feed: 500 } }]);

test('a broken expression emits the author\'s text; runtime tokens and valid maths are untouched', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async (stacks) => {
        const BE = await import('/blocks/blockEmitter.js');
        const out = {};
        for (const [name, stack] of Object.entries(stacks)) out[name] = String(BE.emitProgram(stack, {}));
        return out;
    }, {
        undeclared: mv('widht / 2'),
        undeclaredBare: mv('fedrate'),
        malformed: mv('3 +'),
        runtimeVar: mv('#500'),
        runtimeExpr: mv('[#5 + 1]'),
        validMaths: mv('10 + 5'),
        plainNumber: mv(12.5),
    });

    // ① the author's text survives, intact
    expect(r.undeclared, 'an undeclared identifier rides out as written').toContain('Xwidht / 2');
    expect(r.undeclaredBare).toContain('Xfedrate');
    expect(r.malformed, 'malformed syntax too — the controller is the one that gets to refuse it').toContain('X3 +');

    // ② the "watch for" — no numeric formatter may mangle it on the way out
    for (const [name, text] of Object.entries(r)) {
        expect(text, `${name}: a raw string must never reach a numeric formatter`).not.toContain('NaN');
        expect(text, `${name}: nor land as undefined`).not.toContain('undefined');
    }

    // ③ RUNTIME values are a different concern and are UNCHANGED
    expect(r.runtimeVar, 'a #var is unknowable at authoring time BY DESIGN — it already rode out verbatim').toContain('X#500');
    expect(r.runtimeExpr, 'and so does a bracketed controller expression').toContain('X[#5 + 1]');

    // ④ well-formed maths is still computed, not echoed
    expect(r.validMaths, 'a valid expression still resolves').toContain('X15');
    expect(r.validMaths).not.toContain('X10 + 5');
    expect(r.plainNumber, 'and a literal is unaffected').toContain('X12.5');

    // ⑤ the laundering is gone: the old behaviour was a legal, wrong, silent line
    expect(r.undeclared, 'the typo must NOT be laundered into a legal move to zero').not.toMatch(/X0(\s|$)/);
});

test('the file and the warning tell ONE story — the emit shows the text, the badge names it', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsLoadBlockStack && window.ddcsPreflightCheck, undefined, { timeout: 30_000 });
    await page.evaluate(async () => {
        const SP = await import('/ui/settingsPanel.js');
        SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true },
            machine: { x: 600, y: 600, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [{ x: 0, y: 0, z: 0 }] } } });
        window.dispatchEvent(new Event('ddcs:settings-changed'));
        await new Promise((r) => setTimeout(r, 200));
    });

    const r = await page.evaluate(async () => {
        window.ddcsLoadBlockStack([
            { id: 'op1', type: 'move', params: { mode: 'rapid', x: 10, y: 10, z: -5, feed: 500 } },
            { id: 'op2', type: 'move', params: { mode: 'rapid', x: 'widht / 2', y: 20, z: -5, feed: 500 } },
        ]);
        await new Promise((res) => setTimeout(res, 500));
        const gcode = document.getElementById('editor').value;
        const pf = window.ddcsPreflightCheck();
        return {
            gcode,
            status: pf.status,
            exprRows: (pf.violations || []).filter((v) => v.kind === 'unresolved-expr').map((v) => v.msg),
        };
    });

    expect(r.gcode, 'the FILE carries the author\'s text to the controller').toContain('Xwidht / 2');
    expect(r.gcode, 'and never a laundered NaN').not.toContain('NaN');
    expect(r.status, 'the BADGE cannot verify a move whose coordinate never resolved').toBe('amber');
    expect(r.exprRows.join(' | '), 'and it names the identifier').toContain('widht');
});
