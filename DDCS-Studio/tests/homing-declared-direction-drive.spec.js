import { test, expect } from '@playwright/test';

/**
 * HOMING — split from homing-declared-direction.spec.js at the t2695 tier migration (batch 5). The file's first
 * 3 tests moved to tests/node/homing-declared-direction.test.mjs (all pure); this one stayed because it opens the
 * real wizard, plays a real Three.js simulation, and takes a screenshot.
 */
test.use({ viewport: { width: 1300, height: 950 } });
test('DRIVE THE APP: with a STALE dir=-, machine.z=-120 still homes Z UP to the top (not plunged) — screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.preview = s.preview || {}; s.preview.autoLoop = false;
        s.machine = { x: 300, y: 200, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        // the human's config: machine.z=-120 (home at the TOP) BUT a STALE per-axis dir='-' that used to plunge Z to -120
        s.homing = { axes: { z: { method: 'native', dir: '-', backoff: 5, enable: true, order: 1 } } };
    });
    // t1730 — 'homing' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_homing_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());
    // t542 — PLAY the REAL emitted homing code (the preview no longer uses a proxy). simSpeed up the slow re-touch so it
    // settles fast, then assert the PLAYED engine homed Z to the TOP (-5, backed off), NOT the -120 plunge (-115).
    await page.evaluate(() => { const host = document.querySelector('.wiz-viz3d'); const run = host.querySelector('.pp-run'); if (run) run.click(); const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 60; });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine && !p.engine.running; }, null, { timeout: 20000 });
    const endZ = await page.evaluate(() => +window.ddcsStudio.wizardManager._activePanel.engine.pos.z.toFixed(1));
    expect(endZ, 'even with a stale dir=-, the PLAYED real emit homes Z to the TOP (~-5), not the -120 plunge (-115)').toBeGreaterThan(-8);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_declared_dir_top.png', clip: _b }); }   // t710 clip capture (rAF-starvation dodge)
});
