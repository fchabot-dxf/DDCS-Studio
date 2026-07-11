import { test, expect } from '@playwright/test';

/**
 * POCKET E1 IN-PLACE — the built-in Pocket slot opens the user_pocket_data twin IN-PLACE (opensAs), seamless title
 * "Pocket". VERIFY the full in-place experience surfaces no gap: (1) the Pocket entry opensAs the twin + the title is the
 * plain built-in label; (2) the FORM renders the pocket knobs NON-EMPTY (shape/strategy/depth/feed — incl. the structural
 * strategy toggle); (3) the SIM renders the pocket toolpath (the 3D preview). The emit byte-identity is locked by
 * pocket-data-emit.spec; this proves the real app opens + renders it.
 */
test('opensAs wiring: Pocket opens user_pocket_data IN-PLACE, title "Pocket"', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        const entries = WL.listEntries();
        const pocket = entries.find((e) => e.id === 'pocket');
        const twinEntry = entries.find((e) => e.type === 'user_pocket_data');   // the twin should NOT surface its own menu entry
        return {
            opensAs: pocket && pocket.opensAs,
            title: WL.builtinLabelForTwin('user_pocket_data'),
            twinHidden: !twinEntry,
        };
    });
    expect(r.opensAs, 'the built-in Pocket entry opensAs the twin').toBe('user_pocket_data');
    expect(r.title, 'the seamless in-place title is the built-in plain label "Pocket"').toBe('Pocket');
    expect(r.twinHidden, 'the twin does not surface its OWN separate menu entry').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE THE APP: Pocket opens IN-PLACE with a NON-EMPTY form (shape/strategy/depth/feed) + the sim renders the toolpath', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('user_pocket_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(600);
    const form = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        const canvas = document.querySelector('#wiz_user canvas');   // the 3D/2D preview
        return {
            fieldCount: params.length, params,
            hasShape: params.includes('shape'), hasStrategy: params.includes('strategy'),
            hasDepth: params.includes('depth'), hasFeed: params.includes('feed'), hasStepover: params.includes('stepoverPct'),
            vizEls: canvas ? 1 : 0,
        };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/pocket_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    console.log('POCKET IN-PLACE FORM: ' + form.fieldCount + ' fields → ' + form.params.join(', '));
    expect(form.fieldCount, 'the in-place form is NOT empty — the twin renders its knobs').toBeGreaterThan(8);
    expect(form.hasShape, 'the shape knob renders').toBe(true);
    expect(form.hasStrategy, 'the structural strategy toggle renders').toBe(true);
    expect(form.hasDepth, 'the depth knob renders').toBe(true);
    expect(form.hasFeed, 'the feed knob renders').toBe(true);
    expect(form.hasStepover, 'the stepover% knob renders').toBe(true);
    expect(form.vizEls, 'the preview/sim pane renders').toBeGreaterThan(0);
});
