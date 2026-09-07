import { test, expect } from '@playwright/test';

/**
 * ATC TOOL LENGTH — the in-place form (a NON-EMPTY form) + the 3D machine sim.
 *
 * Split from atc-length-in-place.spec.js at the tier migration work package D; its three sibling tests (the emit
 * byte-identity sweep, the cross-dialect sweep, and the pure opensAs wiring check) moved to
 * tests/node/atc-length-in-place.test.mjs. This one stayed because it opens the twin via window.openWiz, reads real
 * DOM, and screenshots the panel.
 */
const OPTYPE = 'user_atc_length_data';

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE: ATC Tool Length opens IN-PLACE with a NON-EMPTY form + the 3D machine sim renders', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate((op) => window.openWiz(op), OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        const canvas = document.querySelector('#wiz_user canvas');   // the form3d machine preview
        return { fieldCount: params.length, params, hasViz: !!canvas };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/atc_length_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(r.fieldCount, 'the in-place form renders its knobs (maxDist/retract/feeds/port/blockHeight/safeZ)').toBeGreaterThan(4);
    expect(r.params.includes('blockHeight'), 'the Setter Block Height knob renders').toBe(true);
    expect(r.hasViz, 'the 3D machine-frame sim renders (form3d + forceMachine)').toBe(true);
    console.log('ATC-LENGTH IN-PLACE FORM: ' + r.fieldCount + ' fields → ' + r.params.join(', '));
});
