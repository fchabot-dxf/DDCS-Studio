import { test, expect } from '@playwright/test';

/**
 * Comm "Dwell" UNIT correctness (scout F3, t604) + the t632 UN-FREEZE. The comm `val` field is MILLISECONDS; the dwell
 * atom's contract is SECONDS. The bug fed ms straight in → 1000× too long. The fix converts at the call site (val ÷ 1000).
 * t632 made the dwell (and every HMI idiom) a DIALECT-AWARE ATOM that folds at EMIT time, so passing the target dialect to
 * emitMapped yields each post's own P form — Expert/V4.1 round to ms (P500), DM500 keeps seconds (P0.5) — AND the twin folds
 * the SAME way (the old "superset baked ONCE at the Expert dialect → DM500 twin freezes at P500" limitation is GONE).
 */
test('comm Dwell (500 ms) folds per-post — Expert/V4.1 P500 (ms), DM500 P0.5 (s) — on BOTH the stack and the (un-frozen) twin', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { commDataDef } = await import('/blocks/dataOps/commData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { commStack } = await import('/wizards/communicationWizard.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        registerUserOp(commDataDef());
        const build = builderOf('user_comm_data');
        const c = { type: 'dwell', val: 500 };   // 500 ms = 0.5 s
        const out = {};
        for (const prof of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
            const dialect = getDialect(prof);
            const stack = emitMapped(commStack(c), { dialect }).text;
            const twin = emitMapped(build(c), { dialect }).text;
            const dwellLine = stack.split('\n').find((l) => /^G0?4 P/.test(l.trim())) || '';
            out[prof] = { dwellLine: dwellLine.trim(), stackHasBug: /P500000\b/.test(stack), twinEqualsStack: twin === stack, twinDwell: (twin.split('\n').find((l) => /^G0?4 P/.test(l.trim())) || '').trim() };
        }
        return out;
    });
    // per-post NUMERIC truth (500 ms → 0.5 s): the dwell atom folds via dialect.dwell — Expert/V4.1 P=ms (P500), DM500 P=sec (P0.5).
    expect(r['ddcs-expert-m350'].dwellLine, 'Expert P = ms → P500 (0.5 s)').toBe('G04 P500');
    expect(r['ddcs-v41'].dwellLine, 'V4.1 P = ms → P500 (0.5 s)').toBe('G04 P500');
    expect(r['ddcs-v3-dm500'].dwellLine, 'DM500 P = seconds → P0.5 (0.5 s)').toBe('G04 P0.5');
    // the 1000× bug is gone on EVERY post
    for (const prof of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
        expect(r[prof].stackHasBug, `${prof}: no P500000 (500 s) bug`).toBe(false);
    }
    // t632 UN-FREEZE — the twin now folds the SAME per-post form as the stack on EVERY post, incl. DM500 (was P500, now P0.5).
    for (const prof of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
        expect(r[prof].twinEqualsStack, `${prof}: user_comm_data twin == commStack (byte-identity, un-frozen)`).toBe(true);
    }
    expect(r['ddcs-v3-dm500'].twinDwell, 'the DM500 twin dwell is un-frozen → P0.5 (the old freeze read P500)').toBe('G04 P0.5');
});
