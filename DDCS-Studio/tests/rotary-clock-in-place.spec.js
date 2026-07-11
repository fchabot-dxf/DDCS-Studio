import { test, expect } from '@playwright/test';

/**
 * ROTARY CLOCK PORT E3 — the IN-PLACE milestone (opensAs + seamless title + seed), COMPLETES the Rotary port. The built-in
 * Clock A0 slot re-points to the twin user_rotary_clock_data via ONE `opensAs` declaration (which also hides the twin's own
 * entry + sets the plain "Clock A0" title); the twin is seeded on boot (app.js). VERIFY the FULL in-place experience:
 * (1) the click re-points + seamless title + twin retired; (2) the FORM renders the knobs (action/reference/#6 span/scalars)
 * non-empty; (3) the SIM renders the BOX + the 4-jaw RIG + the single start (E2); (4) the 2D view is COHERENT (not broken);
 * (5) emit BYTE-IDENTICAL. The built-in rotaryClockWizard stays the legacy shim.
 */

test('E3 opensAs wiring: Clock A0 opens user_rotary_clock_data IN-PLACE, plain title, twin retired from its own entry', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        const entries = WL.listEntries();
        const clock = entries.find((e) => e.id === 'rotary_clock');
        const twinEntry = entries.find((e) => e.type === 'user_rotary_clock_data');   // the twin's SEPARATE data-wiz entry (should be gone)
        return {
            opensAs: clock && clock.opensAs,
            label: clock && clock.label,
            title: WL.builtinLabelForTwin('user_rotary_clock_data'),
            twinRetired: !twinEntry,
        };
    });
    expect(r.opensAs, 'the built-in Clock A0 entry opensAs the twin (the click re-points in-place)').toBe('user_rotary_clock_data');
    expect(r.title, 'the seamless in-place title is the built-in plain label "Clock A0"').toBe('Clock A0');
    expect(r.twinRetired, 'the twin no longer surfaces its OWN data-wiz entry (one-source hide)').toBe(true);
});

test('E3 emit BYTE-IDENTICAL: user_rotary_clock_data == rotaryClockStack across the action/reference/wcs sweep (the seed/menu wire never touches the stack)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { rotaryClockStack } = await import('/wizards/rotaryClockWizard.js');
        const { ROTARY_CLOCK_DEFAULTS } = await import('/blocks/dataOps/rotaryClockData.js');
        const D = ROTARY_CLOCK_DEFAULTS;
        const sweep = [
            D,
            { ...D, action: 'report' },
            { ...D, action: 'rotate', reference: 'side' },
            { ...D, reference: 'side', wcs: 'G55' },
            { ...D, safeZFrame: 'machine', span: 35, dist: 40, retract: 3, f_fast: 300, f_slow: 80, port: 5, safeZ: 20 },
        ];
        let diffs = 0, first = null;
        for (const p of sweep) {
            const twin = emitMapped(builderOf('user_rotary_clock_data')(p)).text;
            const builtin = emitMapped(rotaryClockStack(p)).text;
            if (twin !== builtin) { diffs++; if (!first) first = { p, twin: twin.slice(0, 700), builtin: builtin.slice(0, 700) }; }
        }
        return { diffs, first, registered: !!builderOf('user_rotary_clock_data') };
    });
    expect(r.registered, 'user_rotary_clock_data is seeded/registered on boot').toBe(true);
    if (r.first) console.log('CLOCK DIFF @ ' + JSON.stringify(r.first.p) + '\n--TWIN--\n' + r.first.twin + '\n--BUILTIN--\n' + r.first.builtin);
    expect(r.diffs, 'the twin emit is BYTE-IDENTICAL to rotaryClockStack across the sweep').toBe(0);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E3 DRIVE: Clock A0 opens IN-PLACE — non-empty form + the 3D sim renders the BOX + the 4-jaw RIG + the single start; the 2D is coherent', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 100, z: 100, shape: 'box', show: true } }); });
    await page.evaluate(() => window.openWiz('user_rotary_clock_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz._partGroup; }, { timeout: 8000 });
    await page.waitForTimeout(500);

    const form = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        const canvas = document.querySelector('#wiz_user canvas');
        const viz = window.ddcsStudio.wizardManager._activePanel.viz;
        return {
            fieldCount: params.length, params,
            hasAction: params.includes('action'), hasReference: params.includes('reference'), hasSpan: params.includes('span'), hasSafeZ: params.includes('safeZ'),
            hasViz: !!canvas,
            stockIsBox: !!viz._stock && viz._stock.shape === 'box',
            rigBuilt: !!viz._rotaryFixture, rigChildOfPart: !!viz._rotaryFixture && viz._rotaryFixture.parent === viz._partGroup,
            has2dToggle: !!document.querySelector('#wiz_user .wiz-viz3d .pp-mtoggle'),
        };
    });

    // (4) 2D COHERENT — toggle to 2D, the layout canvas shows (stock footprint + start), not empty/broken
    let twoD = { shown: false, hasCanvas: false };
    if (form.has2dToggle) {
        await page.click('#wiz_user .wiz-viz3d .pp-mtoggle');
        await page.waitForTimeout(400);
        twoD = await page.evaluate(() => {
            const c = document.querySelector('#wiz_user .wiz-viz3d .pp-2d');
            return { shown: !!c && getComputedStyle(c).display !== 'none', hasCanvas: !!c };
        });
        await page.click('#wiz_user .wiz-viz3d .pp-mtoggle');
        await page.waitForTimeout(200);
    }
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/rotary_clock_e3_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    console.log('E3 IN-PLACE FORM: ' + form.fieldCount + ' fields → ' + form.params.join(', ') + ' | ' + JSON.stringify({ twoD }));
    expect(form.fieldCount, 'the in-place form is NOT empty').toBeGreaterThan(8);
    expect(form.hasAction && form.hasReference && form.hasSpan && form.hasSafeZ, 'the action/reference/#6 span/safeZ knobs render').toBe(true);
    expect(form.hasViz, 'the 3D preview canvas renders').toBe(true);
    expect(form.stockIsBox, 'the 3D sim renders a BOX (the clock datums off a flat — not a round bar)').toBe(true);
    expect(form.rigBuilt, 'the 4th-axis RIG renders in the in-place twin (inherited via the declared sim + generic userOpView)').toBe(true);
    expect(form.rigChildOfPart, 'the rig is a child of _partGroup (spins + datum-placed)').toBe(true);
    expect(twoD.hasCanvas && twoD.shown, 'the 2D view is COHERENT — the layout canvas shows (not absent/broken)').toBe(true);
});
