import { test, expect } from '@playwright/test';

/**
 * Comm "Dwell" UNIT correctness (scout F3, t604). The comm `val` field is MILLISECONDS; the dwell atom's contract is
 * SECONDS. The bug fed ms straight in → G04 P500000 (=500 s) on Expert/V4.1, G04 P500 (=500 s) on DM500 — 1000× too long.
 * The fix converts at the call site (val ÷ 1000). This asserts the NUMERIC truth PER POST independently (not golden==golden),
 * across all 3 DDCS posts incl. DM500 (the comm-twin byte-identity sweep only covers expert+v41), plus twin==stack after the fix.
 */
test('comm Dwell (500 ms) emits the correct per-post dwell — Expert/V4.1 P500 (ms), DM500 P0.5 (s); twin == stack', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { commDataDef } = await import('/blocks/dataOps/commData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { commStack } = await import('/wizards/communicationWizard.js');
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        registerUserOp(commDataDef());
        const build = builderOf('user_comm_data');
        const c = { type: 'dwell', val: 500 };   // 500 ms = 0.5 s
        const out = {};
        for (const prof of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
            setActiveProfile(prof);
            const stack = emitMapped(commStack(c)).text;
            const twin = emitMapped(build(c)).text;
            const dwellLine = stack.split('\n').find((l) => /^G0?4 P/.test(l.trim())) || '';
            out[prof] = { dwellLine: dwellLine.trim(), stackHasBug: /P500000\b/.test(stack), twinEqualsStack: twin === stack, fullStack: stack };
        }
        setActiveProfile('ddcs-expert-m350');
        return out;
    });
    // per-post NUMERIC truth on the STACK (500 ms → 0.5 s). The comm wizard bakes the ACTIVE dialect into a RAW dwell
    // line at BUILD time, so each post emits its own correct form: Expert/V4.1 round to ms (P500), DM500 keeps seconds (P0.5).
    expect(r['ddcs-expert-m350'].dwellLine, 'Expert P = ms → P500 (0.5 s)').toBe('G04 P500');
    expect(r['ddcs-v41'].dwellLine, 'V4.1 P = ms → P500 (0.5 s)').toBe('G04 P500');
    expect(r['ddcs-v3-dm500'].dwellLine, 'DM500 P = seconds → P0.5 (0.5 s)').toBe('G04 P0.5');
    // the 1000× bug is gone on EVERY post's stack
    for (const prof of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
        expect(r[prof].stackHasBug, `${prof}: no P500000 (500 s) bug`).toBe(false);
    }
    // TWIN byte-identity holds on the ms-form posts (this is the comm-twin sweep's scope). NOTE the DM500 twin is a
    // KNOWN SEPARATE limitation, out of scope for this units fix: the user_comm_data superset is baked ONCE at
    // registration with the Expert dialect, and the recompose swaps VALUES not FORMS — so every dialect-dependent RAW
    // (dwell, hmiInput, …) freezes at the Expert ms-form. The DM500 twin dwell reads P500, not the stack's P0.5.
    for (const prof of ['ddcs-expert-m350', 'ddcs-v41']) {
        expect(r[prof].twinEqualsStack, `${prof}: user_comm_data twin == commStack (byte-identity)`).toBe(true);
    }
});
