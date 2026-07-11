import { test, expect } from '@playwright/test';

/** t696 — three small independent items: (a) autostart staleness fingerprint, (c) projects-drawer resize handle,
 *  (b4) the wizard "Presets" affordance. */
test.use({ viewport: { width: 1200, height: 900 } });   // (c) needs room — 85vw of the default 412px would clamp the drawer

test('(a) autostart STALENESS FINGERPRINT: a homing-config change flags the stored body; regenerate clears it; persists', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.showApp);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.homing = { axes: { x: { enable: true, order: 1 }, y: { enable: true, order: 2 }, z: { enable: true, order: 0 } } }; });
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForFunction(() => window.showMacrosPanel, null, { timeout: 8000 });
    await page.evaluate(() => window.showMacrosPanel('macros_panel_sysstart'));
    await page.waitForSelector('#sysstart_regen');
    await page.click('#sysstart_regen');   // regenerate → stores the body + the input fingerprint
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.getElementById('sysstart_editnote').textContent), 'freshly generated → in sync').toMatch(/in sync/i);
    // change a homing input (disable an axis → homingRunParams output differs → the fingerprint drifts)
    await page.evaluate(() => { window.ddcsGetSettings().homing.axes.x.enable = false; window.dispatchEvent(new CustomEvent('ddcs:settings-changed')); });   // Settings dispatches this on any change → the note refreshes
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.getElementById('sysstart_editnote').textContent), 'the homing-config drift is flagged').toMatch(/homing profile changed/i);
    await page.click('#sysstart_regen');   // regenerate → re-fingerprints
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.getElementById('sysstart_editnote').textContent), 'regenerate clears the staleness').toMatch(/in sync/i);
    // the fingerprint persists across reload
    await page.reload();
    await page.waitForFunction(() => window.ddcsGetSettings);
    expect(await page.evaluate(() => window.ddcsGetSettings().autostartGenSig), 'the fingerprint persists (stored with the body)').toBeTruthy();
});

test('(c) PROJECTS DRAWER RESIZE HANDLE: drag sets a persisted, clamped width; survives reload', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    await page.evaluate(() => localStorage.removeItem('ddcs_proj_drawer_w'));
    await page.evaluate(async () => { const m = await import('/ui/projects/projectModal.js'); m.openOpenDrawer(); });
    await page.waitForSelector('.proj-drawer:not([hidden]) .proj-resize');
    const w0 = await page.evaluate(() => document.querySelector('.proj-drawer').getBoundingClientRect().width);
    // drag the right-edge grip from ~w0 to ~w0+140
    const box = await page.locator('.proj-resize').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(w0 + 140, box.y + 200, { steps: 8 });
    await page.mouse.up();
    const w1 = await page.evaluate(() => document.querySelector('.proj-drawer').getBoundingClientRect().width);
    expect(w1, 'the drawer widened by the drag').toBeGreaterThan(w0 + 80);
    const stored = await page.evaluate(() => parseInt(localStorage.getItem('ddcs_proj_drawer_w'), 10));
    expect(stored, 'the width persisted to localStorage').toBeGreaterThan(w0 + 80);
    // reload → the width is restored
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio);
    await page.evaluate(async () => { const m = await import('/ui/projects/projectModal.js'); m.openOpenDrawer(); });
    await page.waitForSelector('.proj-drawer:not([hidden])');
    const w2 = await page.evaluate(() => document.querySelector('.proj-drawer').getBoundingClientRect().width);
    expect(Math.abs(w2 - w1), 'the resized width survives reload').toBeLessThan(6);
});

test('(b4) PRESETS affordance: a labeled button (not a bare emoji) opens the popover with terse copy', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
    await page.waitForSelector('#wiz_drill', { state: 'visible' });
    expect(await page.evaluate(() => document.querySelector('.wiz-templates').textContent), 'a labeled Presets affordance, not a bare emoji').toMatch(/Presets/);
    await page.click('.wiz-templates');
    await page.waitForSelector('.wiz-tpl-pop .wt-save', { timeout: 5000 });
    expect(await page.evaluate(() => document.querySelector('.wt-head').textContent), 'popover titled Presets').toMatch(/Presets/i);
    expect(await page.evaluate(() => document.querySelector('.wt-save').textContent), 'terse save copy').toMatch(/preset/i);
    expect(await page.evaluate(() => (document.querySelector('.wt-note') || {}).textContent || ''), 'a line distinguishes it from Save-as-custom-wizard').toMatch(/custom wizard/i);
});
