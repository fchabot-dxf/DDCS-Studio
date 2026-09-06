import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';   // t684 d — in-app dialog

/**
 * SYSSTART GENERATE NOW HOMES (t626) — split from homing-sysstart-real.spec.js at the t2695 tier migration
 * (batch 5). The file's first test moved to tests/node/homing-sysstart-real.test.mjs (pure); this one stayed
 * because it drives the real Macros panel (a click, a real `#sysstart_body` textarea read).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const SETTINGS = {
    machine: { x: 600, y: 400, z: 500, softLimits: true },
    limits: { zMaxHome: true, xMinHome: true, yMinHome: true },
    homing: { philosophy: 'sequential', axes: {
        z: { enable: true, order: 1, method: 'seek', seekFeed: 600 },
        x: { enable: true, order: 2, method: 'seek', seekFeed: 800 },
        y: { enable: true, order: 3, method: 'seek', seekFeed: 800 },
    } },
};

test('the Macros → sysstart REGENERATE rebuilds the real homing sequence into the STORED body (t656 real-symptom drive)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.showApp);
    await page.evaluate((S) => { Object.assign(window.ddcsGetSettings(), S); }, SETTINGS);
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForFunction(() => window.showMacrosPanel, null, { timeout: 8000 });
    await page.evaluate(() => window.showMacrosPanel('macros_panel_sysstart'));
    await page.waitForSelector('#sysstart_regen', { state: 'attached', timeout: 8000 });   // t746 — REAL readiness (the panel + Regenerate button rendered), not a 200ms sleep that lost the race under -workers contention
    await autoAppDialog(page, { accept: true });   // any clobber-confirm → accept (a fresh seed isn't hand-edited, so usually none)
    await page.click('#sysstart_regen');
    await page.waitForFunction(() => { const b = document.getElementById('sysstart_body'); return b && /M30/.test(b.value); }, null, { timeout: 8000 });   // t746 — wait for the REGEN to actually write the body (was a 200ms sleep → empty body under contention)
    const out = await page.evaluate(() => (document.getElementById('sysstart_body') || {}).value || '');
    expect(out, 'the regenerated body carries the real G31 homing sequence, not the stub').toMatch(/G31 Z\S+ F600/);
    expect(out).toMatch(/G31 X\S+ F800/);
    expect(out).not.toMatch(/No axes selected to home/);
    expect(out, 'still wraps with M30').toMatch(/M30/);
    // t656 — the regenerated body is STORED (the editor is the source of truth; Push sends exactly this)
    const stored = await page.evaluate(() => window.ddcsGetSettings().autostartBody);
    expect(stored, 'the body is stored in settings.autostartBody').toBe(out);
    // the homing-summary section is GONE from the panel (dropped)
    const gone = await page.evaluate(() => !document.getElementById('sysstart_homing_summary') && !document.getElementById('sysstart_gen') && !document.getElementById('sysstart_out'));
    expect(gone, 'the homing-summary section + the old Generate/output are removed').toBe(true);
});
