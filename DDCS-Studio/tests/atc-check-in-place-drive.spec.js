import { test, expect } from '@playwright/test';

/**
 * ATC TOOL CHECK — the in-place form (a NON-EMPTY form incl. tolerance) + the 3D machine sim.
 *
 * Split from atc-check-in-place.spec.js at the tier migration work package D; its three sibling tests (the emit
 * byte-identity sweep, the cross-dialect sweep, and the pure opensAs wiring check) moved to
 * tests/node/atc-check-in-place.test.mjs. This one stayed because it opens the twin via window.openWiz, reads real
 * DOM, and screenshots the panel.
 */
const OPTYPE = 'user_atc_check_data';

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE: ATC Tool Check opens IN-PLACE with a NON-EMPTY form (incl. tolerance) + the 3D machine sim renders', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate((op) => window.openWiz(op), OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        const canvas = document.querySelector('#wiz_user canvas');
        return { fieldCount: params.length, params, hasViz: !!canvas };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/atc_check_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(r.fieldCount, 'the in-place form renders its 8 knobs').toBeGreaterThan(5);
    expect(r.params.includes('tolerance'), 'the Tolerance knob renders (the check-specific param)').toBe(true);
    expect(r.hasViz, 'the 3D machine-frame sim renders').toBe(true);
    console.log('ATC-CHECK IN-PLACE FORM: ' + r.fieldCount + ' fields → ' + r.params.join(', '));
});
