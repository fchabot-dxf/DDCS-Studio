import { test, expect } from '@playwright/test';

/**
 * ATC-TABLE E2 (t568) — the in-place form = the two include toggles + the 'Edit table…' action button + the emit
 * preview (NO second table editor — the edit UI stays Settings → Tool table) · the machine + magazine 3D sim.
 *
 * Split from atc-table-in-place.spec.js at the tier migration work package D; its sibling test (the pure opensAs
 * wiring + opSimContext check) moved to tests/node/atc-table-in-place.test.mjs. This one stayed because it opens the
 * twin via window.openWiz, reads real DOM, and screenshots the panel.
 */
const OPTYPE = 'user_atc_table_data';

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE: Tool Table opens IN-PLACE — the two include toggles + the Edit-table button + the live-view emit + the 3D sim', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => {
        const real = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        window.__realSettings = real;
        window.ddcsGetSettings = () => ({ ...window.__realSettings, atc: { ...(window.__realSettings.atc || {}), tools: [{ num: 1, length: 42, name: 'endmill' }, { num: 2, length: 55, name: 'drill' }], magazine: [{ pocket: 1, x: 100, y: 50, z: -20 }, { pocket: 2, x: 150, y: 50, z: -20 }] } });
    });
    await page.evaluate((op) => window.openWiz(op), OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = [...new Set(Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param')))];
        const editBtn = f.querySelector('[data-param="_setup"]');
        const code = (document.getElementById('wiz_user_code') || {}).textContent || '';
        return { params, hasEditBtn: !!(editBtn && editBtn.textContent.includes('Edit')), code, hasViz: !!document.querySelector('#wiz_user canvas') };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/atc_table_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(r.params.includes('includeLengths'), 'the "Write tool lengths" toggle renders').toBe(true);
    expect(r.params.includes('includePockets'), 'the "Write pocket positions" toggle renders').toBe(true);
    expect(r.hasEditBtn, 'the "Edit table…" action button renders (no second table editor)').toBe(true);
    expect(r.code, 'the emit unrolls T1 from the live table (#1430 = 42)').toMatch(/#1430=42/);
    expect(r.code, 'the emit unrolls T2 (#1431 = 55)').toMatch(/#1431=55/);
    expect(r.hasViz, 'the 3D machine-frame sim renders').toBe(true);
    console.log('ATC-TABLE IN-PLACE: ' + r.params.join(',') + ' | ' + r.code.split('\n').length + ' lines');
});
