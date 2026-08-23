import { test, expect } from '@playwright/test';

/** t696 — small independent items: (a) autostart staleness fingerprint, (b4) the wizard "Presets" affordance.
 *  (c) the projects-drawer resize handle was retired at t2190 with the drawer itself (ui/projects/projectModal.js's
 *  openOpenDrawer() is deleted — see ui/projects/projectManager.js's header for the replacement). */
test.use({ viewport: { width: 1200, height: 900 } });

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

test('(b4) PRESETS affordance: the form-top preset row (header button retired) opens the popover with terse copy', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
    await page.waitForSelector('#wiz_drill', { state: 'visible' });
    // t794 — Presets moved from the header to an adaptive form-top row; the header .wiz-templates is retired.
    expect(await page.locator('.wiz-templates').count(), 'the header Presets button is retired').toBe(0);
    await page.waitForSelector('#wiz_drill .wiz-preset-row .wpr-save', { timeout: 5000 });
    expect(await page.evaluate(() => document.querySelector('#wiz_drill .wiz-preset-row .wpr-save').textContent), 'a labeled Save-preset affordance in the form row').toMatch(/preset|save/i);
    await page.click('#wiz_drill .wiz-preset-row .wpr-save');
    await page.waitForSelector('.wiz-tpl-pop .wt-save', { timeout: 5000 });
    expect(await page.evaluate(() => document.querySelector('.wt-head').textContent), 'popover titled Presets').toMatch(/Presets/i);
    expect(await page.evaluate(() => document.querySelector('.wt-save').textContent), 'terse save copy').toMatch(/preset/i);
    expect(await page.evaluate(() => (document.querySelector('.wt-note') || {}).textContent || ''), 'a line distinguishes it from Save-as-custom-wizard').toMatch(/custom wizard/i);
});
