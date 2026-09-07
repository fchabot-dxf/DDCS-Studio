import { test, expect } from '@playwright/test';

/**
 * ATC TEST E2 (t560) — the in-place panel renders the form (both modes' fields) + the emit preview + the machine-frame
 * 3D sim with the magazine.
 *
 * Split from atc-test-in-place.spec.js at the tier migration work package D; its sibling test (the pure opensAs
 * wiring + opSimContext check) moved to tests/node/atc-test-in-place.test.mjs. This one stayed because it opens the
 * twin via window.openWiz, reads real DOM, clicks a segmented-control button, and screenshots the panel.
 */
const OPTYPE = 'user_atc_test_data';

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE: ATC Test opens IN-PLACE — both modes render their fields + the emit preview + the machine+magazine 3D sim', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    // seed a 3-pocket magazine into the live settings so the pockets dry-run unrolls + the 3D magazine tiles render
    await page.evaluate(() => {
        const real = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        window.__realSettings = real;
        window.ddcsGetSettings = () => ({
            ...window.__realSettings,
            atc: { ...(window.__realSettings.atc || {}), magazine: [{ tool: 1, x: 100, y: 50, z: -20, pocket: 1 }, { tool: 2, x: 150, y: 50, z: -20, pocket: 2 }, { tool: 3, x: 200, y: 50, z: -20, pocket: 3 }], tools: [{ num: 1, type: 'endmill', dia: 6 }, { num: 2, type: 'endmill', dia: 6 }, { num: 3, type: 'drill', dia: 5 }] },
        });
    });
    await page.evaluate((op) => window.openWiz(op), OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);

    // DRAWBAR mode (the default) — the form renders all 7 fields as def params; the emit preview is the drawbar cycle
    const drawbar = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        const code = (document.getElementById('wiz_user_code') || {}).textContent || '';
        const canvas = document.querySelector('#wiz_user canvas');
        return { params: [...new Set(params)], code, hasViz: !!canvas };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/atc_test_inplace_drawbar.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    // switch to POCKETS mode via the segmented widget → the emit unrolls the 3 taught pockets
    await page.click('.seg-control[data-param="mode"] button[data-value="pockets"]');
    await page.waitForTimeout(500);
    const pockets = await page.evaluate(() => {
        const code = (document.getElementById('wiz_user_code') || {}).textContent || '';
        const canvas = document.querySelector('#wiz_user canvas');
        return { code, hasViz: !!canvas };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/atc_test_inplace_pockets.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    // the form fields ARE the def params (mode + drawbar + pockets)
    for (const p of ['mode', 'cycles', 'dwellMs', 'first', 'count', 'zClear', 'descend']) {
        expect(drawbar.params.includes(p), `the in-place form renders the "${p}" knob (a def param)`).toBe(true);
    }
    expect(drawbar.code, 'drawbar mode: the emit preview is the drawbar cycle test').toMatch(/Drawbar|M154/);
    expect(drawbar.hasViz, 'the 3D machine-frame sim renders').toBe(true);
    expect(pockets.code, 'pockets mode: the emit preview unrolls pocket 1').toContain('Pocket 1');
    expect(pockets.code, 'pockets mode: the emit preview unrolls the 3rd taught pocket (live magazine)').toContain('Pocket 3');
    expect(pockets.hasViz, 'the 3D sim renders in pockets mode too').toBe(true);
    console.log('ATC-TEST IN-PLACE: fields=' + drawbar.params.join(',') + ' | pockets lines=' + pockets.code.split('\n').length);
});
