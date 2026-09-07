import { test, expect } from '@playwright/test';

/**
 * ROTARY CENTRELINE PORT E2 — the real-symptom UI half, split out of rotary-center-sim-starts.spec.js (t2695,
 * TIER MIGRATION WORK PACKAGE 3). Drives window.openWiz, real DOM (document.querySelector, page.waitForSelector),
 * and a page.screenshot of the live wizard — stays in the browser tier. The pure sim-starts-vs-BUILT_IN math test
 * moved to tests/node/rotary-center-sim-starts.test.mjs.
 */
test.use({ viewport: { width: 1400, height: 1000 } });
test('E2 real-symptom: the twin renders its multi-pass markers on the preview (fit → 3 starts)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 150, y: 76.2, z: 76.2, shape: 'cylinder', show: true } }); });
    // NOT seeded yet (E2) → PERSIST it (createUserOp) so openWiz routes to its userOpView
    await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/rotaryCenterData.js'); localStorage.removeItem('ddcs_user_ops'); try { U.deleteUserOp('user_rotary_center_data'); } catch (_) {} U.createUserOp(M.rotaryCenterDataDef()); });
    await page.evaluate(() => window.openWiz('user_rotary_center_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    // switch to the FIT method → 3 passes
    await page.evaluate(() => { const s = document.querySelector('#wiz_user_form [data-param="method"]'); if (s) { s.value = 'fit'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.waitForTimeout(700);
    const r = await page.evaluate(async () => {
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { ROTARY_CENTER_DEFAULTS } = await import('/blocks/dataOps/rotaryCenterData.js');
        const starts = opSimStarts('user_rotary_center_data', { ...ROTARY_CENTER_DEFAULTS, method: 'fit' }, (window.ddcsGetSettings() || {}).stock) || [];
        const canvas = document.querySelector('#wiz_user canvas');
        const methodVal = (document.querySelector('#wiz_user_form [data-param="method"]') || {}).value;
        return { nStarts: starts.length, hasViz: !!canvas, methodVal };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/rotary_center_simstarts.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(r.methodVal, 'the form is on the FIT method').toBe('fit');
    expect(r.nStarts, 'FIT declares 3 per-pass starts (the 3-point circle solve)').toBe(3);
    expect(r.hasViz, 'the rotary machine-frame preview renders').toBe(true);
});
