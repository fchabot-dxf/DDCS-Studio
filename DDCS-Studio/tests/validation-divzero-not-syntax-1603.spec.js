import { test, expect } from '@playwright/test';

/**
 * t1603 — DIVISION BY ZERO DURING VALIDATION IS NOT A SYNTAX ERROR.
 *
 * The t1601 registry sweep found the shipped send gate refusing a shipped wizard: `user_lathe_odturn` emits
 * `#137=[0-[#125*[#120-#122]/[#128-#122]]]`, and `validateExpression` failed it — its dummy vars all read 1,
 * so the denominator `[#128-#122]` evaluated to 0 and the division "failed". The validator's own comment
 * always promised the opposite ("dummy vars read 1 so syntactically-valid divisions don't false-fail"), and
 * the dummy-1 mechanism alone cannot keep that promise: ANY subtraction of two dummies is 0.
 *
 * THE RULE: validation checks SYNTAX; arithmetic outcomes on dummy values are not syntax. In validation mode
 * a /0 yields a benign finite dummy and the parse continues. The RUNTIME meaning of a real division by zero
 * is untouched — the engine still resolves it to null, exactly as before.
 *
 * ⚠ AND NOTHING ELSE WIDENED: everything the t1573/t1583/t1601 family refuses — trailing tokens, stray
 * commas, unclosed brackets, unknown functions — refuses still. Those are GRAMMAR verdicts, reached before
 * any arithmetic; this act changed one arithmetic case inside an otherwise-valid parse.
 */

// The exact rhs the lathe OD-turn twin ships, transcribed from its emit.
const LATHE_RHS = '[0-[#125*[#120-#122]/[#128-#122]]]';

test('the lathe line validates; runtime /0 is untouched; every family refusal still refuses', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async (latheRhs) => {
        const { evalExpr, validateExpression } = await import('/engine/core/expression.js');
        const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
        // REAL values where the denominator is genuinely zero (#128 == #122), and where it is not.
        const zeroDen = new Map([[125, 5], [120, 10], [122, 2], [128, 2]]);
        const okDen = new Map([[125, 5], [120, 10], [122, 2], [128, 6]]);
        return {
            latheValid: validateExpression(latheRhs),
            latheLineGate: GcodeExecutionEngine.defaultSyntaxVerify(`#137=${latheRhs}\nM30`).valid,
            // ⚠ deliberate: a LITERAL /0 also validates now. The machine's behaviour on a real /0 is untested
            // (no probe), and the gate's doctrine is asymmetric — guessing TIGHT risks the false refusal it
            // cannot have. The runtime still refuses to produce a number for it (next two rows).
            literalDivZeroValid: validateExpression('1/0'),
            runtimePreview: evalExpr('1/0', new Map()),
            runtimeEngine: evalExpr('1/0', new Map(), { unsetValue: 0 }),
            runtimeLatheZeroDen: evalExpr(latheRhs, zeroDen, { unsetValue: 0 }),
            runtimeLatheOkDen: evalExpr(latheRhs, okDen, { unsetValue: 0 }),
            // the family's refusals, one per class — grammar verdicts must be unreachable by this change
            unclosed: validateExpression('[1 + 2'),
            trailing: validateExpression('#191k8'),
            trailingBracket: validateExpression('[1 + 2 k 8]'),
            bareWord: validateExpression('widht'),
            strayComma: validateExpression('[1, 2]'),
            wrongArity: validateExpression('ABS[1, 2]'),
            unknownFn: validateExpression('NOSUCH[1]'),
            unclosedCall: validateExpression('ATAN[1, 1'),
        };
    }, LATHE_RHS);

    expect(r.latheValid, 'the exact shipped lathe rhs validates — the false refusal is gone').toBe(true);
    expect(r.latheLineGate, 'and the full assignment line passes the send gate').toBe(true);
    expect(r.literalDivZeroValid, 'a literal /0 is a RUNTIME concern, not a syntax refusal (asymmetric doctrine)').toBe(true);

    expect(r.runtimePreview, 'runtime: /0 still resolves to NOTHING in the preview').toBeNull();
    expect(r.runtimeEngine, 'runtime: and on the engine reading — unchanged by the validation knob').toBeNull();
    expect(r.runtimeLatheZeroDen, 'runtime: the lathe line with a REAL zero denominator is still unresolvable').toBeNull();
    expect(r.runtimeLatheOkDen, 'runtime: and with real non-zero values it computes — 0-[5*(10-2)/(6-2)] = -10').toBe(-10);

    for (const k of ['unclosed', 'trailing', 'trailingBracket', 'bareWord', 'strayComma', 'wrongArity', 'unknownFn', 'unclosedCall']) {
        expect(r[k], `${k}: a GRAMMAR refusal must survive the arithmetic leniency`).toBe(false);
    }
});

/**
 * THE SYMPTOM ITSELF: the real Send view, the real click, the real dialog — with the real lathe program.
 * t1601 asserted the verdict through `defaultSyntaxVerify`; this act is ABOUT the dialog's false alarm, so
 * the dialog is what must be seen NOT to appear. Same one-and-only lift as send-gate-wiring-1585: the Send
 * button's connection-contract `disabled` flag is cleared (staging needs no machine); everything else —
 * click, handler, parser, dialog — is the shipped chain.
 */
test.use({ viewport: { width: 1300, height: 850 } });

test('the real Send dialog does NOT falsely refuse the shipped lathe OD-turn program', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsLoadBlockStack, undefined, { timeout: 30_000 });

    // stage the SHIPPED program: the OD-turn twin at its declared defaults, emitted by the app itself
    const staged = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const spec = U.listUserOps().find((s) => s.opType === 'user_lathe_odturn');
        if (!spec) return { ok: false, why: 'no user_lathe_odturn in the registry' };
        window.ddcsLoadBlockStack(U.instantiate(spec, { ...U.defaultParams(spec) }));
        await new Promise((r) => setTimeout(r, 700));
        const text = document.getElementById('editor').value;
        return { ok: /#137\s*=\s*\[0-\[#125/.test(text.replace(/\s+/g, '')) || text.includes('#137'), len: text.length };
    });
    expect(staged.ok, `the OD-turn program is in the editor (${staged.why || staged.len + ' bytes'})`).toBe(true);

    const clickBtn = (txt) => page.evaluate((t) => {
        const hit = [...document.querySelectorAll('button')]
            .filter((e) => (e.textContent || '').includes(t))
            .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
        if (!hit) return false;
        hit.disabled = false;   // the CONNECTION contract only, never the gate
        hit.click();
        return true;
    }, txt);

    await page.getByText('GATEWAY', { exact: false }).first().click();
    await page.waitForTimeout(600);
    expect(await clickBtn('Send'), 'the Send view opens').toBe(true);
    await page.waitForTimeout(700);
    expect(await clickBtn('Use current Studio program'), 'the current program stages').toBe(true);
    await page.waitForTimeout(900);
    expect(await clickBtn('Send (tracked)'), 'and the send is attempted').toBe(true);
    await page.waitForTimeout(12_000);   // the mismatch probe must time out against a dead gateway first

    const dlg = await page.evaluate(() => [...document.querySelectorAll('dialog,.dlg,.modal,[role=dialog]')]
        .map((d) => (d.textContent || '')).join('\n'));

    expect(dlg, 'the false alarm is GONE: no "cannot read this file" for a program Studio itself emitted')
        .not.toContain('The controller cannot read this file');
});
