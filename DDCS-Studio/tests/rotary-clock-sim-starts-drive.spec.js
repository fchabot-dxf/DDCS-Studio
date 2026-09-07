import { test, expect } from '@playwright/test';

/**
 * ROTARY CLOCK PORT E2 — the real-symptom UI half, split out of rotary-clock-sim-starts.spec.js (t2695, TIER
 * MIGRATION WORK PACKAGE 3). Drives window.openWiz, real DOM, and reads live Three.js viz object state
 * (viz._stock, viz._rotaryFixture) — stays in the browser tier. The pure sim-starts-vs-formula math test moved
 * to tests/node/rotary-clock-sim-starts.test.mjs.
 */
test.use({ viewport: { width: 1400, height: 1000 } });
test('E2 real-symptom: the twin renders the BOX + the 4th-axis RIG + the single start on the preview (clock = a flat on a box, not a bar)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 100, z: 100, shape: 'box', show: true } }); });
    // NOT seeded yet (E2) → PERSIST it (createUserOp) so openWiz routes to its userOpView
    await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/rotaryClockData.js'); localStorage.removeItem('ddcs_user_ops'); try { U.deleteUserOp('user_rotary_clock_data'); } catch (_) {} U.createUserOp(M.rotaryClockDataDef()); });
    await page.evaluate(() => window.openWiz('user_rotary_clock_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz._partGroup; }, { timeout: 8000 });
    await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { ROTARY_CLOCK_DEFAULTS } = await import('/blocks/dataOps/rotaryClockData.js');
        const starts = opSimStarts('user_rotary_clock_data', { ...ROTARY_CLOCK_DEFAULTS }, (window.ddcsGetSettings() || {}).stock) || [];
        const viz = window.ddcsStudio.wizardManager._activePanel.viz;
        const canvas = document.querySelector('#wiz_user canvas');
        return {
            nStarts: starts.length, hasViz: !!canvas,
            stockShape: viz._stock && viz._stock.shape,
            rigBuilt: !!viz._rotaryFixture, rigChildOfPart: !!viz._rotaryFixture && viz._rotaryFixture.parent === viz._partGroup,
        };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/rotary_clock_e2_sim.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(r.nStarts, 'the clock declares TWO sim-starts (A + B, both draggable)').toBe(2);
    expect(r.hasViz, 'the rotary machine-frame preview renders').toBe(true);
    expect(r.stockShape, 'the clock sim shows a rectangular BOX (a flat, not a round bar → no def.simStock)').toBe('box');
    expect(r.rigBuilt, 'the 4th-axis RIG renders (inherited FREE via the declared sim{rotary:true} + the generic userOpView, E5)').toBe(true);
    expect(r.rigChildOfPart, 'the rig is a child of _partGroup (spins + datum-placed)').toBe(true);
});
