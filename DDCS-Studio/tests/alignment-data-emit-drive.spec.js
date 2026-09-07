import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT PORT E1+E2 — the data-op twin's emit is BYTE-IDENTICAL to the built-in alignmentStack + the (existing) sim-starts.
 *
 * t2694 — TIER MIGRATION WORK PACKAGE 4: split from alignment-data-emit.spec.js. This test opens a real wizard
 * (window.openWiz), waits on a real DOM selector + a rendered viz panel, and reads live form/canvas DOM (viz._stock,
 * viz._rotaryFixture, document.querySelectorAll('[data-param]')) — a genuine app+DOM+render dependency, not a pure
 * import()+evaluate. Its siblings (E1 byte-diff + E2 sim-starts positions — pure, no DOM) moved to
 * tests/node/alignment-data-emit.test.mjs.
 */
test.use({ viewport: { width: 1400, height: 1000 } });
test('E2 real-symptom: the twin renders the BOX + the 2 fence starts on the preview (alignment = a fence probe, NO rig/bar)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true } }); });
    await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/alignmentData.js'); localStorage.removeItem('ddcs_user_ops'); try { U.deleteUserOp('user_alignment_data'); } catch (_) {} U.createUserOp(M.alignmentDataDef()); });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz._partGroup; }, { timeout: 8000 });
    await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { ALIGNMENT_DEFAULTS } = await import('/blocks/dataOps/alignmentData.js');
        const starts = opSimStarts('user_alignment_data', { ...ALIGNMENT_DEFAULTS }, (window.ddcsGetSettings() || {}).stock) || [];
        const viz = window.ddcsStudio.wizardManager._activePanel.viz;
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        return {
            nStarts: starts.length, hasViz: !!document.querySelector('#wiz_user canvas'),
            stockShape: viz._stock && viz._stock.shape, noRig: !viz._rotaryFixture,
            fieldCount: params.length, hasCheckAxis: params.includes('checkAxis'), hasProbeDir: params.includes('probeDir'), hasSafeZ: params.includes('safeZ'), hasTolerance: params.includes('tolerance'),
        };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/alignment_e2_sim.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(r.nStarts, 'the alignment declares 2 sim-starts (A + B along the fence)').toBe(2);
    expect(r.hasViz, 'the machine-frame preview renders').toBe(true);
    expect(r.stockShape, 'the sim shows a rectangular BOX (a fence probe — no round bar)').toBe('box');
    expect(r.noRig, 'NO 4th-axis rig (alignment is not rotary)').toBe(true);
    expect(r.fieldCount, 'the form is NON-EMPTY').toBeGreaterThan(6);
    expect(r.hasCheckAxis && r.hasProbeDir && r.hasSafeZ && r.hasTolerance, 'the checkAxis/probeDir/safeZ/tolerance knobs render').toBe(true);
});
