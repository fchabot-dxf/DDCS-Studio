import { test, expect } from '@playwright/test';

/**
 * CONTOUR PORT E1 — the IN-PLACE milestone. The built-in Contour mill slot re-points to the twin user_contour_data via
 * ONE `opensAs` declaration (which also hides the twin's own data-wiz entry + gives the seamless plain "Contour" title).
 * VERIFY: (1) the Contour entry opensAs the twin; (2) the twin is seeded/registered on boot; (3) the in-place FORM renders
 * NON-EMPTY + correct (the drill-flat-form lesson — the flat-atom bindings surface as fields); (4) the 2D layout renders.
 */
test('E1 opensAs wiring: Contour opens user_contour_data IN-PLACE, plain title, twin retired from its own entry', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        const entries = WL.listEntries();
        const contour = entries.find((e) => e.id === 'contour');
        const twinEntry = entries.find((e) => e.type === 'user_contour_data');
        const { builderOf } = await import('/blocks/opBuilders.js');
        return {
            opensAs: contour && contour.opensAs,
            title: WL.builtinLabelForTwin('user_contour_data'),
            twinRetired: !twinEntry,
            registered: !!builderOf('user_contour_data'),
        };
    });
    expect(r.opensAs, 'the built-in Contour entry opensAs the twin (in-place re-point)').toBe('user_contour_data');
    expect(r.title, 'the seamless in-place title is the plain built-in label "Contour"').toBe('Contour');
    expect(r.twinRetired, 'the twin no longer surfaces its OWN data-wiz entry (one-source hide)').toBe(true);
    expect(r.registered, 'user_contour_data is seeded/registered on boot').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E1 DRIVE: Contour opens IN-PLACE with a NON-EMPTY, correct form + the 2D layout renders', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('user_contour_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);

    const form = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        const canvas = document.querySelector('#wiz_user canvas, #wiz_user svg.feature-canvas');
        return {
            fieldCount: params.length, params,
            hasShape: params.includes('shape'), hasSide: params.includes('side'),
            hasW: params.includes('w'), hasTool: params.includes('toolDia'), hasDepth: params.includes('depth'),
            hasViz: !!canvas,
        };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/contour_e1_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    console.log('E1 IN-PLACE FORM: ' + form.fieldCount + ' fields → ' + form.params.join(', ') + ' | viz=' + form.hasViz);
    expect(form.fieldCount, 'the in-place form is NOT empty (the drill-flat-form lesson)').toBeGreaterThan(8);
    expect(form.hasShape && form.hasSide && form.hasW && form.hasTool && form.hasDepth, 'the shape/side/width/tool/depth knobs render').toBe(true);
    expect(form.hasViz, 'the preview canvas/2D layout renders').toBe(true);
});
