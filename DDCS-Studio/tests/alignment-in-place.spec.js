import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT PORT E3 — the IN-PLACE milestone (opensAs + seamless title + seed), COMPLETES the probe fan-out (all 6 probe
 * wizards in-place). The built-in Align slot re-points to the twin user_alignment_data via ONE `opensAs` declaration (which
 * also hides the twin's own entry + sets the plain "Align" title); the WIZ_SPECIAL_OPENER openAlignmentWiz routing retires
 * (the fn survives as the legacy shim, unrelated to the ⟳ Align rotate button); the twin is seeded on boot. VERIFY:
 * (1) the click re-points + seamless title + twin retired; (2) the FORM renders the knobs non-empty; (3) the SIM renders the
 * box + 2 fence starts (no rig); (4) the 2D is coherent; (5) emit BYTE-IDENTICAL; (7) the G68 ⟳ Align rotate flow is unaffected.
 */

test('E3 opensAs wiring: Align opens user_alignment_data IN-PLACE, plain title, twin retired, openAlignmentWiz retired', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        const entries = WL.listEntries();
        const align = entries.find((e) => e.id === 'alignment');
        const twinEntry = entries.find((e) => e.type === 'user_alignment_data');
        return {
            opensAs: align && align.opensAs,
            title: WL.builtinLabelForTwin('user_alignment_data'),
            twinRetired: !twinEntry,
            // t1730 (gameplan step 2, Tier B) — openAlignmentWiz was the legacy shim to the coded AlignmentWizard
            // view; both the shim and its target view are now DELETED (not just un-routed), alongside every
            // other legacy caller (wizardManager.openAlignment/updateAlignmentWizard/_startAlignmentAnim,
            // app.js's setupVisualizationListeners). A raw opType:'alignment' op now degrades via the
            // "no longer editable here" toast instead — see WORK-LOG t1730.
            alignFnGone: typeof window.openAlignmentWiz === 'undefined',
        };
    });
    expect(r.opensAs, 'the built-in Align entry opensAs the twin (the click re-points in-place)').toBe('user_alignment_data');
    expect(r.title, 'the seamless in-place title is the built-in plain label "Align"').toBe('Align');
    expect(r.twinRetired, 'the twin no longer surfaces its OWN data-wiz entry (one-source hide)').toBe(true);
    expect(r.alignFnGone, 'openAlignmentWiz is retired, not just un-routed').toBe(true);
});

test('E3 emit BYTE-IDENTICAL: user_alignment_data == alignmentStack across the checkAxis/probeDir/frame sweep (the seed/menu wire never touches the stack)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { ALIGNMENT_DEFAULTS } = await import('/blocks/dataOps/alignmentData.js');
        const D = { ...ALIGNMENT_DEFAULTS, travel: 'manual' };   // t510 — the sweep pins the MANUAL emit (stock-independent, byte-identical); AUTO byte-identity is its own test
        const sweep = [
            D,
            { ...D, checkAxis: 'Y' },
            { ...D, probeDir: 'neg' },
            { ...D, checkAxis: 'Y', probeDir: 'neg', safeZFrame: 'machine' },
            { ...D, safeZ: 20, tolerance: 0.02, dist: 40, retract: 3, f_fast: 300, f_slow: 40, port: 5 },
        ];
        let diffs = 0, first = null;
        for (const p of sweep) {
            const twin = emitMapped(builderOf('user_alignment_data')(p)).text;
            const builtin = emitMapped(alignmentStack(p)).text;
            if (twin !== builtin) { diffs++; if (!first) first = { p, twin: twin.slice(0, 700), builtin: builtin.slice(0, 700) }; }
        }
        return { diffs, first, registered: !!builderOf('user_alignment_data') };
    });
    expect(r.registered, 'user_alignment_data is seeded/registered on boot').toBe(true);
    if (r.first) console.log('ALIGN DIFF @ ' + JSON.stringify(r.first.p) + '\n--TWIN--\n' + r.first.twin + '\n--BUILTIN--\n' + r.first.builtin);
    expect(r.diffs, 'the twin emit is BYTE-IDENTICAL to alignmentStack across the sweep').toBe(0);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E3 DRIVE: Align opens IN-PLACE — non-empty form + the 3D sim renders the box + 2 fence starts (no rig); the 2D is coherent', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true } }); });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz._partGroup; }, { timeout: 8000 });
    await page.waitForTimeout(500);

    const form = await page.evaluate(async () => {
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { ALIGNMENT_DEFAULTS } = await import('/blocks/dataOps/alignmentData.js');
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        const viz = window.ddcsStudio.wizardManager._activePanel.viz;
        const starts = opSimStarts('user_alignment_data', { ...ALIGNMENT_DEFAULTS }, (window.ddcsGetSettings() || {}).stock) || [];
        return {
            fieldCount: params.length, params,
            hasCheckAxis: params.includes('checkAxis'), hasProbeDir: params.includes('probeDir'), hasSafeZ: params.includes('safeZ'), hasTolerance: params.includes('tolerance'),
            hasViz: !!document.querySelector('#wiz_user canvas'),
            stockIsBox: !!viz._stock && viz._stock.shape === 'box', noRig: !viz._rotaryFixture, nStarts: starts.length,
            has2dToggle: !!document.querySelector('#wiz_user .wiz-viz3d .pp-mtoggle'),
        };
    });

    let twoD = { shown: false, hasCanvas: false };
    if (form.has2dToggle) {
        await page.click('#wiz_user .wiz-viz3d .pp-mtoggle');
        await page.waitForTimeout(400);
        twoD = await page.evaluate(() => { const c = document.querySelector('#wiz_user .wiz-viz3d .pp-2d'); return { shown: !!c && getComputedStyle(c).display !== 'none', hasCanvas: !!c }; });
        await page.click('#wiz_user .wiz-viz3d .pp-mtoggle');
        await page.waitForTimeout(200);
    }
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/alignment_e3_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    console.log('E3 IN-PLACE FORM: ' + form.fieldCount + ' fields → ' + form.params.join(', ') + ' | ' + JSON.stringify({ twoD, nStarts: form.nStarts }));
    expect(form.fieldCount, 'the in-place form is NOT empty').toBeGreaterThan(6);
    expect(form.hasCheckAxis && form.hasProbeDir && form.hasSafeZ && form.hasTolerance, 'the checkAxis/probeDir/safeZ/tolerance knobs render').toBe(true);
    expect(form.hasViz, 'the 3D preview canvas renders').toBe(true);
    expect(form.stockIsBox, 'the 3D sim renders a BOX (a fence probe — no round bar)').toBe(true);
    expect(form.noRig, 'NO 4th-axis rig (alignment is not rotary)').toBe(true);
    expect(form.nStarts, 'the 2 fence starts (A/B) render').toBe(2);
    expect(twoD.hasCanvas && twoD.shown, 'the 2D view is COHERENT — the layout canvas shows (not absent/broken)').toBe(true);
});
