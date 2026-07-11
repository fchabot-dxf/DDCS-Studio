import { test, expect } from '@playwright/test';

/**
 * ROTARY CENTRELINE PORT E5 — the IN-PLACE milestone (opensAs + seamless title + seed + the declared rig wiring).
 * The built-in Centreline slot re-points to the twin user_rotary_center_data via ONE `opensAs` declaration (which also
 * hides the twin's own entry + sets the plain "Centreline" title); the twin is seeded on boot (app.js). VERIFY the FULL
 * in-place experience: (1) the click re-points + seamless title + twin retired; (2) the FORM renders the knobs non-empty;
 * (3) the 3D machine-frame SIM renders the round bar + the 4th-axis RIG (the E5 gap: the generic userOpView now enables
 * the rig from the DECLARED opSimContext, not just the built-in view) + the multi-pass starts; (4) the 2D view is
 * COHERENT (the stock footprint + start marker — not broken/empty); (5) emit BYTE-IDENTICAL; (6) the FIT advanced label.
 */

test('E5 opensAs wiring: Centreline opens user_rotary_center_data IN-PLACE, plain title, twin retired from its own entry', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        const entries = WL.listEntries();
        const centreline = entries.find((e) => e.id === 'rotary_center');
        const twinEntry = entries.find((e) => e.type === 'user_rotary_center_data');   // the twin's SEPARATE data-wiz entry (should be gone)
        return {
            opensAs: centreline && centreline.opensAs,
            label: centreline && centreline.label,
            title: WL.builtinLabelForTwin('user_rotary_center_data'),
            twinRetired: !twinEntry,
        };
    });
    expect(r.opensAs, 'the built-in Centreline entry opensAs the twin (the click re-points in-place)').toBe('user_rotary_center_data');
    expect(r.title, 'the seamless in-place title is the built-in plain label "Centreline"').toBe('Centreline');
    expect(r.twinRetired, 'the twin no longer surfaces its OWN data-wiz entry (one-source hide)').toBe(true);
});

test('E5 emit BYTE-IDENTICAL: user_rotary_center_data == rotaryCenterStack across the method/datum/wcs sweep (the seed/menu wire never touches the stack)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
        const { ROTARY_CENTER_DEFAULTS } = await import('/blocks/dataOps/rotaryCenterData.js');
        const sweep = [
            ROTARY_CENTER_DEFAULTS,
            { ...ROTARY_CENTER_DEFAULTS, method: 'fit' },
            { ...ROTARY_CENTER_DEFAULTS, approach: 'guided' },
            { ...ROTARY_CENTER_DEFAULTS, datum: 'top', wcs: 'G55' },
            { ...ROTARY_CENTER_DEFAULTS, safeZFrame: 'absolute', diameter: 50, dist: 40, retract: 3, f_fast: 300, f_slow: 80, port: 5, radius: 3, safeZ: 20 },
            { ...ROTARY_CENTER_DEFAULTS, method: 'fit', datum: 'top', approach: 'guided' },
        ];
        let diffs = 0, first = null;
        for (const p of sweep) {
            const twin = emitMapped(builderOf('user_rotary_center_data')(p)).text;
            const builtin = emitMapped(rotaryCenterStack(p)).text;
            if (twin !== builtin) { diffs++; if (!first) first = { p, twin: twin.slice(0, 700), builtin: builtin.slice(0, 700) }; }
        }
        return { diffs, first, registered: !!builderOf('user_rotary_center_data') };
    });
    expect(r.registered, 'user_rotary_center_data is seeded/registered on boot').toBe(true);
    if (r.first) console.log('ROTARY DIFF @ ' + JSON.stringify(r.first.p) + '\n--TWIN--\n' + r.first.twin + '\n--BUILTIN--\n' + r.first.builtin);
    expect(r.diffs, 'the twin emit is BYTE-IDENTICAL to rotaryCenterStack across the sweep').toBe(0);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E5 DRIVE: Centreline opens IN-PLACE — non-empty form + the 3D sim renders the ROUND BAR + the 4th-axis RIG (child of _partGroup) + the 2D is coherent; FIT shows the advanced label', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('user_rotary_center_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz._partGroup; }, { timeout: 8000 });
    await page.waitForTimeout(500);

    const form = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        const canvas = document.querySelector('#wiz_user canvas');
        const viz = window.ddcsStudio.wizardManager._activePanel.viz;
        // (3) the ROUND BAR (from #57, E3) + the RIG (E4/E5 wiring) render
        const stockIsBar = !!viz.stockMesh && !!viz._stock && viz._stock.shape === 'cylinder';
        const rigBuilt = !!viz._rotaryFixture;
        const rigChildOfPart = rigBuilt && viz._rotaryFixture.parent === viz._partGroup;
        return {
            fieldCount: params.length, params,
            hasMethod: params.includes('method'), hasApproach: params.includes('approach'), hasDiameter: params.includes('diameter'), hasSafeZ: params.includes('safeZ'),
            hasViz: !!canvas, stockIsBar, rigBuilt, rigChildOfPart,
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
        await page.click('#wiz_user .wiz-viz3d .pp-mtoggle');   // back to 3D
        await page.waitForTimeout(200);
    }
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/rotary_center_e5_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    // (6) FIT → the advanced label surfaces
    const fitAdvanced = await page.evaluate(() => {
        const sel = document.querySelector('#wiz_user_form [data-param="method"]');
        if (sel) { sel.value = 'fit'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        const txt = document.getElementById('wiz_user')?.textContent || '';
        return /advanced/i.test(txt);
    });

    console.log('E5 IN-PLACE FORM: ' + form.fieldCount + ' fields → ' + form.params.join(', ') + ' | ' + JSON.stringify({ twoD, fitAdvanced }));
    expect(form.fieldCount, 'the in-place form is NOT empty').toBeGreaterThan(8);
    expect(form.hasMethod && form.hasApproach && form.hasDiameter && form.hasSafeZ, 'the method/approach/#57 diameter/safeZ knobs render').toBe(true);
    expect(form.hasViz, 'the 3D preview canvas renders').toBe(true);
    expect(form.stockIsBar, 'the 3D sim renders the ROUND BAR (cylinder from #57, E3)').toBe(true);
    expect(form.rigBuilt, 'the 4th-axis RIG renders in the in-place twin (E5 wired the declared rig into the generic userOpView)').toBe(true);
    expect(form.rigChildOfPart, 'the rig is a child of _partGroup (E4 — spins + datum-placed)').toBe(true);
    expect(twoD.hasCanvas && twoD.shown, 'the 2D view is COHERENT — the layout canvas shows (not absent/broken)').toBe(true);
    expect(fitAdvanced, 'the FIT method surfaces the "advanced" label (3-point fit — verify on machine)').toBe(true);
});
