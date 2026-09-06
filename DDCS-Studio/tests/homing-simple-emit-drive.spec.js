import { test, expect } from '@playwright/test';

/**
 * t536 HOMING part 2 — split from homing-simple-emit.spec.js at the t2695 tier migration (batch 5), exactly as
 * the dispatch itself anticipated. The file's first test moved to tests/node/homing-simple-emit.test.mjs (pure);
 * this one stayed because it drives the real wizard code preview and takes a screenshot.
 */
test.use({ viewport: { width: 1300, height: 950 } });
test('REAL APP: a saved-native config code preview shows the SHORT G31 block per axis (screenshot)', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('ddcs_studio_settings', JSON.stringify({
            machine: { x: 600, y: 600, z: 500, workOrigin: { x: 0, y: 0, z: 0 } },
            inputs: [{ id: 'probe', type: 'probe', label: '3D Probe', pin: 5, level: 0 }, { id: 'setter', type: 'setter', label: 'Tool Setter', pin: 6, level: 0 }],
            limits: {},
            homing: { philosophy: 'sequential', axes: { z: { enable: true, order: 1, method: 'native', seekFeed: 800, slowFeed: 100, backoff: 5 }, x: { enable: true, order: 2, method: 'native' }, y: { enable: true, order: 3, method: 'native' } } },
        }));
    });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    // t1730 — 'homing' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    const code = await page.evaluate(() => document.getElementById('wiz_user_code').textContent || '');
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_simple_g31.png', clip: _b }); }   // t710 clip capture (rAF-starvation dodge)
    console.log('CODE PREVIEW:\n' + code);
    expect(code, 'the code preview shows G31 (the saved native is ignored — no toggle)').toContain('G31');
    expect(code, 'NOT M98 P501 in the preview').not.toContain('M98P501');
    expect(code, 'no GOTO soup in the preview').not.toMatch(/GOTO\d/);
});
