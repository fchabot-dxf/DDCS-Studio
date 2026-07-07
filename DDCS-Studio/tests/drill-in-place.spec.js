import { test, expect } from '@playwright/test';

/**
 * DRILL FINISH-TO-IN-PLACE — the QUICK-WINS PILOT (t405). The emit-only twin user_drill_data goes IN-PLACE via the
 * corner/edge/middle opensAs mechanism (ONE declaration re-points the built-in Drill slot + hides the twin's own
 * Mill-Data-Wiz entry + sets the seamless "Drill" title). VERIFY the FULL in-place experience — surface any emit-only-twin
 * gap: (1) the built-in Drill opens user_drill_data in-place; (2) the FORM renders the drill knobs (not empty/broken);
 * (3) emit BYTE-IDENTICAL (the drill golden); (4) the SIM renders. BORE stays built-in (the peck-only-twin gap surfaced).
 */
test('opensAs wiring: Drill opens user_drill_data IN-PLACE, title "Drill", twin retired from mill_datawiz; Bore opens its OWN helical twin', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        const entries = WL.listEntries();
        const drill = entries.find((e) => e.id === 'drill');
        const bore = entries.find((e) => e.id === 'bore');
        const twinEntry = entries.find((e) => e.type === 'user_drill_data');   // the SEPARATE Mill-Data-Wiz entry (should be gone)
        return {
            drillOpensAs: drill && drill.opensAs,
            drillLabel: drill && drill.label,
            boreOpensAs: bore ? bore.opensAs : 'NO-BORE',
            title: WL.builtinLabelForTwin('user_drill_data'),
            twinRetired: !twinEntry,
        };
    });
    expect(r.drillOpensAs, 'the built-in Drill entry opensAs the twin (the click re-points)').toBe('user_drill_data');
    expect(r.title, 'the seamless in-place title is the built-in plain label "Drill"').toBe('Drill');
    expect(r.twinRetired, 'the twin no longer surfaces its OWN Mill-Data-Wiz entry (one-source hide)').toBe(true);
    expect(r.boreOpensAs, 'BORE now opens its OWN helical twin (user_drill_data is peck-only — method=helical swaps the block type)').toBe('user_bore_data');
});

test('emit BYTE-IDENTICAL: user_drill_data == the built-in drillStack across a param sweep (the twin is unchanged by the in-place wire)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { DRILL_DEFAULTS } = await import('/blocks/dataOps/drillData.js');
        const sweep = [
            DRILL_DEFAULTS,
            { ...DRILL_DEFAULTS, pattern: 'circle', count: 6, dia: 60 },
            { ...DRILL_DEFAULTS, pattern: 'line', count: 5, spacing: 15, angle: 30 },
            { ...DRILL_DEFAULTS, x0: 12, y0: -8, depth: 9, peck: 3, feed: 250 },
            { ...DRILL_DEFAULTS, wcs: 'G55', skip: '2,4' },
        ];
        let diffs = 0, first = null;
        for (const p of sweep) {
            const twin = emitMapped(builderOf('user_drill_data')(p)).text;
            const builtin = emitMapped(drillStack(p)).text;
            if (twin !== builtin) { diffs++; if (!first) first = { p, twin: twin.slice(0, 800), builtin: builtin.slice(0, 800) }; }
        }
        return { diffs, first, registered: !!builderOf('user_drill_data') };
    });
    expect(r.registered, 'user_drill_data is seeded/registered on boot').toBe(true);
    if (r.first) console.log('DRILL DIFF @ ' + JSON.stringify(r.first.p) + '\n--TWIN--\n' + r.first.twin + '\n--BUILTIN--\n' + r.first.builtin);
    expect(r.diffs, 'the twin emit is BYTE-IDENTICAL to drillStack across the sweep (drill golden)').toBe(0);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE THE APP: Drill opens IN-PLACE with a NON-EMPTY form (the emit-only twin renders its knobs) + the sim renders', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('user_drill_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    const form = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        // the form3d preview renders a WebGL canvas in the wizard's visualization pane (a different container than the 2D)
        const canvas = document.querySelector('#wiz_user canvas');
        return {
            fieldCount: params.length, params,
            hasPattern: params.includes('pattern'), hasDepth: params.includes('depth'), hasFeed: params.includes('feed'),
            vizEls: canvas ? 1 : 0,
        };
    });
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/drill_inplace.png' });
    expect(form.fieldCount, 'the in-place form is NOT empty — the emit-only twin renders its knobs').toBeGreaterThan(5);
    expect(form.hasPattern, 'the pattern knob renders').toBe(true);
    expect(form.hasDepth, 'the depth knob renders').toBe(true);
    expect(form.hasFeed, 'the feed knob renders').toBe(true);
    expect(form.vizEls, 'the preview/sim pane renders').toBeGreaterThan(0);
    console.log('DRILL IN-PLACE FORM: ' + form.fieldCount + ' fields → ' + form.params.join(', '));
});
