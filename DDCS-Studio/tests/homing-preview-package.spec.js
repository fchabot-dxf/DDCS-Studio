import { test, expect } from '@playwright/test';

/**
 * t540 HOMING PREVIEW package — parts (2) + (3):
 *  (2) FORCE the machine ENVELOPE box in the machine-frame homing pin, regardless of settings.machine.show (homing motion
 *      IS machine-frame, so the box is its reference; the `show` toggle only governs ordinary part-frame views).
 *  (3) NO SILENT FALLBACK: an unset/0 axis travel is a real config gap — surface a visible 'set … travel' hint + SKIP that
 *      axis in the sim (no fictional -120 span). Configured axes are unaffected.
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function openHoming(page, mutate) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate((src) => {
        const s = window.ddcsGetSettings();
        // eslint-disable-next-line no-new-func
        (new Function('s', src))(s);
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    }, `(${mutate.toString()})(s)`);
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
}

test('(2) the envelope BOX draws in the homing pin even with settings.machine.show OFF', async ({ page }) => {
    await openHoming(page, (s) => {
        s.machine = { x: 600, y: 400, z: 500, show: false, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };  // show OFF
        s.homing = { axes: { z: { enable: true, order: 1 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
        s.stock = { show: false };
    });
    const r = await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        return { show: window.ddcsGetSettings().machine.show, machineBox: !!(p && p.viz && p.viz.machineBox), forced: !!(p && p.viz && p.viz._forceMachineBox) };
    });
    expect(r.show, 'settings.machine.show is OFF (the box is NOT drawn for ordinary part-frame views)').toBe(false);
    expect(r.forced, 'the homing pin FORCED the machine box').toBe(true);
    expect(r.machineBox, 'the envelope box IS drawn despite show OFF (homing is machine-frame)').toBe(true);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_box_forced_showoff.png' });
});

test('(3) an UNSET axis travel surfaces a visible hint + the sim SKIPS that axis (no fictional span)', async ({ page }) => {
    await openHoming(page, (s) => {
        s.machine = { x: 600, y: 400, z: 0, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };  // Z travel UNSET (0)
        s.homing = { axes: { z: { enable: true, order: 1 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
        s.stock = { show: false };
    });
    const r = await page.evaluate(async () => {
        const status = document.getElementById('homing_status');
        const vizStatus = document.getElementById('homingVizStatus');
        const code = document.getElementById('wiz_homing_code').textContent || '';
        return { status: status ? status.textContent : '', vizStatus: vizStatus ? vizStatus.textContent : '', code };
    });
    // the visible hint names Z + says 'set … travel'
    expect(r.status.toLowerCase(), 'the run status shows the unset-travel hint for Z').toContain('set z');
    expect(r.status.toLowerCase()).toContain('travel');
    expect(r.vizStatus.toLowerCase(), 'the viz status shows the hint too').toContain('set z');
    // t542 — the preview PLAYS the emit (no proxy). The emit SKIPS Z (a visible SET-TRAVEL comment, no fabricated seek)
    // but still homes X + Y — so nothing fictional is simulated for the unset axis.
    expect(r.code, 'Z homing is skipped in the emit (unset envelope), with a visible SET-TRAVEL comment').toMatch(/SET Z TRAVEL/i);
    expect(r.code, 'no fabricated Z seek move for the unset axis').not.toMatch(/G31 Z/);
    expect(r.code, 'X still homes (configured envelope)').toMatch(/G31 X/);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_unset_travel_hint.png' });
});
