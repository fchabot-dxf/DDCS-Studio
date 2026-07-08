import { test, expect } from '@playwright/test';

/**
 * Comm/MDI — the MSG ReferenceError fix (t514). commStack called MSG(...) in the NON-HMI fallback branches (popup/status/
 * input) but never defined it → a ReferenceError aborted commStack/generate on any post WITHOUT caps.hmi (Comm was BROKEN
 * on V4.1 / DM500 / grbl / rs274). Fix: MSG = a `message` atom (dialect-aware: hmiToast on HMI, an operator comment on
 * non-HMI). VERIFY: commStack/generate emits (no throw) on BOTH an HMI post (Expert) and a NON-HMI post (V4.1), all types.
 */
test('the MSG bug is fixed: commStack emits on a NON-HMI post (no ReferenceError) + an HMI post, all types', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { commStack } = await import('/wizards/communicationWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        const cases = [
            { type: 'popup', msg: 'Load part', popupMode: 0 },
            { type: 'popup', msg: 'Continue?', popupMode: 1 },
            { type: 'status', msg: 'Running', statusMode: 1 },
            { type: 'input', msg: 'Enter depth', id: '#100' },
            { type: 'beep', val: 500 },
            { type: 'dwell', val: 1000 },
        ];
        const out = {};
        for (const prof of ['ddcs-expert-m350', 'ddcs-v41']) {
            setActiveProfile(prof);
            out[prof] = {};
            for (const c of cases) {
                let text = null, err = null;
                try { text = emitMapped(commStack(c)).text; } catch (e) { err = String((e && e.message) || e); }
                out[prof][c.type + (c.popupMode != null ? c.popupMode : '')] = { text, err };
            }
        }
        setActiveProfile('ddcs-expert-m350');   // restore the default
        return out;
    });
    for (const prof of Object.keys(r)) for (const k of Object.keys(r[prof])) {
        expect(r[prof][k].err, `${prof} ${k}: NO ReferenceError`).toBe(null);
        expect(typeof r[prof][k].text === 'string' && r[prof][k].text.length > 0, `${prof} ${k}: emits G-code`).toBe(true);
    }
    // the non-HMI fallbacks show the message (the `message` atom → an operator comment), not a crash
    expect(/Load part/.test(r['ddcs-v41'].popup0.text), 'non-HMI popup fallback carries the message text').toBe(true);
    expect(/Running/.test(r['ddcs-v41'].status.text), 'non-HMI status fallback carries the message text').toBe(true);
    expect(/Enter depth/.test(r['ddcs-v41'].input.text), 'non-HMI input fallback carries the message text').toBe(true);
});
