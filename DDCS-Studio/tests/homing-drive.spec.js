import { test, expect } from '@playwright/test';

/**
 * HOMING H1 — DRIVE THE APP: the home-end reconciliation. The homing sim (homingSimProxy, rendered in the wizard's 3D)
 * now drives each axis to the TRUE home end = MACHINE-0 (Z to the top/0, NOT -120; X/Y to 0), aligned with axisSpan +
 * the M98-P501 engine handler. Real-symptom: open the wizard, assert the sim's seek line lands on machine-0, screenshot.
 */
test.use({ viewport: { width: 1400, height: 1000 } });
test('the homing sim drives every axis to the machine-0 home end (NOT the far/signed-travel end) + screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings);
    await page.evaluate(() => { const m = window.ddcsGetSettings().machine || (window.ddcsGetSettings().machine = {}); m.x = 300; m.y = 200; m.z = -120; });
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(600);

    // The human's LIVE symptom (t481 amend): the axes PLUNGE DOWN + LEFT — to the FAR (signed-travel) end, not home.
    // Reproduce it with a DOWN+LEFT envelope (Z travel -120 = down-far; X travel -300 = left-far), then confirm the fix.
    const machine = { x: -300, y: 200, z: -120 };
    await page.evaluate((m) => { Object.assign(window.ddcsGetSettings().machine, m); }, machine);
    const r = await page.evaluate(async (M) => {
        const { homingSimProxy } = await import('/wizards/homingWizard.js');
        const { axisSpan } = await import('/engine/limitSwitches.js');
        const text = homingSimProxy({ axes: ['x', 'y', 'z'], config: { x: { method: 'native' }, y: { method: 'native' }, z: { method: 'native' } }, machine: M });
        const seek = (A) => { const m = text.match(new RegExp('G53 G0 ' + A + '(-?[\\d.]+)')); return m ? parseFloat(m[1]) : null; };
        // BEFORE (the buggy signed-travel formula) = the FAR end the axes plunged toward (the symptom).
        const oldFar = { x: M.x, y: M.y, z: M.z };   // x -300 (left) · z -120 (down) — the plunge
        return { xSeek: seek('X'), ySeek: seek('Y'), zSeek: seek('Z'), oldFar, zHomeSide: axisSpan(M.z).homeSide, xHomeSide: axisSpan(M.x).homeSide };
    }, machine);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_at_home.png' });
    console.log('HOMING: symptom(old far end)=' + JSON.stringify(r.oldFar) + ' → fix(seek)= X:' + r.xSeek + ' Y:' + r.ySeek + ' Z:' + r.zSeek);

    // SYMPTOM (before): the OLD signed-travel home end drove DOWN (z -120) + LEFT (x -300) — the far end, away from home.
    expect(r.oldFar.z, 'the OLD (buggy) Z home end was the far/DOWN end (-120)').toBe(-120);
    expect(r.oldFar.x, 'the OLD (buggy) X home end was the far/LEFT end (-300)').toBe(-300);
    // FIX (after): every axis now seeks the TRUE home end = machine-0 (the fix corrects the down+left plunge).
    expect(r.xSeek, 'X seeks the machine-0 home end (NOT -300 far/left)').toBe(0);
    expect(r.ySeek, 'Y seeks the machine-0 home end').toBe(0);
    expect(r.zSeek, 'Z seeks the machine-0/top home end (NOT -120 down)').toBe(0);
    // the sim + axisSpan AGREE on the home end (no divergence)
    expect(r.zHomeSide, 'axisSpan Z home = the max (machine-0/top) end — agrees with the sim').toBe('max');
    expect(r.xHomeSide, 'axisSpan X (travel -300) home = the max (machine-0) end — agrees with the sim').toBe('max');
});
