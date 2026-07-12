import { test, expect } from '@playwright/test';

/**
 * t780 (user) — THE WORK DRIVES THE DEFAULT FIT. With envelope-everywhere default-on, a big declared machine framed the
 * default camera to the whole envelope and shrank the stock/toolpath to a speck. Now: the default fit frames the WORK
 * (data + stock); the envelope stays DRAWN as context and joins the fit only on request — dbl-click cycles work ↔ machine.
 * View-only → emit untouched.
 */
test.use({ viewport: { width: 1300, height: 950 } });

const PROG = 'G90\nG0 X10 Y10 Z5\nG1 Z-2 F200\nX70\nX70 Y60\nX10 Y60\nX10 Y10\nG0 Z5\nM30\n';

test('big machine: the default fit frames the WORK; dbl-click cycles to the envelope and back', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' };
        // the user's class of machine: a huge declared envelope (~3.8m table)
        s.machine = { ...(s.machine || {}), show: true, x: 3800, y: 3900, z: -800 };
        s.preview = s.preview || {}; s.preview.default3D = true; s.preview.autoLoop = false;
    });
    await page.evaluate((g) => { const e = document.getElementById('editor'); e.value = g; window.setGcodeView('3d'); }, PROG);
    await page.waitForFunction(() => window.__gpPanel && window.__gpPanel.viz, null, { timeout: 8000 });
    await page.evaluate(() => { const p = window.__gpPanel; p.setGcode(document.getElementById('editor').value); });
    await page.waitForTimeout(400);

    const dims = await page.evaluate(() => {
        const v = window.__gpPanel.viz;
        return { radius: v.radius, wide: !!v._fitWide, hasBox: !!(v.machineBox && v.machineBox.visible) };
    });
    // WORK-FIT: the camera radius is on the scale of the ~250mm work, nowhere near the ~5.4km envelope diagonal scale
    expect(dims.wide, 'the default fit is the WORK fit (not wide)').toBe(false);
    expect(dims.radius, 'the camera frames the work (radius ≪ the envelope scale)').toBeLessThan(1200);
    expect(dims.hasBox, 'the envelope is still DRAWN as context').toBe(true);

    // dbl-click → the WIDE fit (the envelope drives the frame)
    await page.evaluate(() => { const v = window.__gpPanel.viz; v.renderer.domElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); });
    await page.waitForTimeout(200);
    const wide = await page.evaluate(() => ({ radius: window.__gpPanel.viz.radius, wide: !!window.__gpPanel.viz._fitWide }));
    expect(wide.wide, 'dbl-click reaches the envelope fit').toBe(true);
    expect(wide.radius, 'the wide fit frames the whole machine').toBeGreaterThan(2000);

    // dbl-click again → back to the work fit
    await page.evaluate(() => { const v = window.__gpPanel.viz; v.renderer.domElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); });
    await page.waitForTimeout(200);
    const back = await page.evaluate(() => ({ radius: window.__gpPanel.viz.radius, wide: !!window.__gpPanel.viz._fitWide }));
    expect(back.wide, 'dbl-click cycles back to the work fit').toBe(false);
    expect(back.radius, 'the work framing returns').toBeLessThan(1200);
});

test('small machine: the work fit ≈ the old behavior (envelope ≈ work, nothing shrinks)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' };
        s.machine = { ...(s.machine || {}), show: true, x: 300, y: 250, z: -100 };
        s.preview = s.preview || {}; s.preview.default3D = true; s.preview.autoLoop = false;
    });
    await page.evaluate((g) => { const e = document.getElementById('editor'); e.value = g; window.setGcodeView('3d'); }, PROG);
    await page.waitForFunction(() => window.__gpPanel && window.__gpPanel.viz, null, { timeout: 8000 });
    await page.evaluate(() => { const p = window.__gpPanel; p.setGcode(document.getElementById('editor').value); });
    await page.waitForTimeout(400);
    const dims = await page.evaluate(() => ({ radius: window.__gpPanel.viz.radius }));
    // the work (≈250mm) and the envelope (≈400mm) are the same order — the tight fit is fine for both
    expect(dims.radius).toBeGreaterThan(50);
    expect(dims.radius).toBeLessThan(900);
});

test('wizard on the big machine: the safe-Z retract column no longer blows the default zoom', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 20000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.machine = { ...(s.machine || {}), show: true, x: 3800, y: 3900, z: -800 }; });
    await page.evaluate(() => window.openWiz('user_pocket_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
        const host = [...document.querySelectorAll('#wiz_user *')].find((el) => el.__panel);
        const v = host && host.__panel.viz;
        return v ? { radius: v.radius, wide: !!v._fitWide } : null;
    });
    expect(info, 'the wizard 3D panel is reachable').not.toBeNull();
    expect(info.wide, 'the wizard defaults to the WORK fit').toBe(false);
    // pre-fix this was 1239 (the retract column to machine top drove the frame); the work region is ~250mm
    expect(info.radius, 'the default zoom frames the stock/cut, not the retract column').toBeLessThan(700);
});
