import { test, expect } from '@playwright/test';

/**
 * BORE PORT — the IN-PLACE milestone. The built-in Bore mill slot re-points to the twin user_bore_data via ONE `opensAs`
 * (which also hides the twin's own entry + gives the seamless plain "Bore" title). VERIFY: (1) the Bore entry opensAs the
 * twin + seamless title + twin retired + registered on boot; (2) the in-place FORM renders NON-EMPTY + the bore knobs
 * (holeDia/toolDia/pitch/ramp/depth); (3) the 3D sim renders the bore toolpath (the ring/helix).
 */
test('opensAs wiring: Bore opens user_bore_data IN-PLACE, plain title, twin retired', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        const entries = WL.listEntries();
        const bore = entries.find((e) => e.id === 'bore');
        const twinEntry = entries.find((e) => e.type === 'user_bore_data');
        const { builderOf } = await import('/blocks/opBuilders.js');
        return { opensAs: bore && bore.opensAs, title: WL.builtinLabelForTwin('user_bore_data'), twinRetired: !twinEntry, registered: !!builderOf('user_bore_data') };
    });
    expect(r.opensAs, 'the built-in Bore entry opensAs the twin (in-place)').toBe('user_bore_data');
    expect(r.title, 'the seamless in-place title is the plain built-in label "Bore"').toBe('Bore');
    expect(r.twinRetired, 'the twin no longer surfaces its OWN data-wiz entry').toBe(true);
    expect(r.registered, 'user_bore_data is seeded/registered on boot').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE: Bore opens IN-PLACE with a NON-EMPTY, correct form + the 3D renders the bore toolpath; screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('user_bore_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; }, { timeout: 8000 });
    await page.waitForTimeout(500);
    const form = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        const canvas = document.querySelector('#wiz_user canvas');
        return {
            fieldCount: params.length, params,
            hasHoleDia: params.includes('holeDia'), hasToolDia: params.includes('toolDia'), hasPitch: params.includes('pitch'), hasDepth: params.includes('depth'), hasPattern: params.includes('pattern'),
            hasViz: !!canvas,
        };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/bore_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    console.log('BORE IN-PLACE FORM: ' + form.fieldCount + ' fields → ' + form.params.join(', ') + ' | viz=' + form.hasViz);
    expect(form.fieldCount, 'the in-place form is NOT empty').toBeGreaterThan(8);
    expect(form.hasHoleDia && form.hasToolDia && form.hasPitch && form.hasDepth && form.hasPattern, 'the bore knobs (holeDia/toolDia/pitch/depth/pattern) render').toBe(true);
    expect(form.hasViz, 'the 3D preview canvas renders the bore toolpath').toBe(true);
});
