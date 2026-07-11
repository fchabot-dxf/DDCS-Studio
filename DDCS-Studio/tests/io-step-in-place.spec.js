import { test, expect } from '@playwright/test';

/**
 * SETUP/IO increment 2, E2 — the I/O-step wizard opens IN-PLACE: the mode picker + per-mode fields render, the declared-I/O
 * pickers list settings.outputs/inputs BY NAME, and the INPUT mode greys on a non-Expert post. Screenshots of the 3 modes.
 */
const seed = async (page) => page.evaluate(() => window.__SP.applySettings({
    outputs: [{ id: 'coolant', type: 'custom', label: 'Coolant', pin: 3, onCode: 'M8', offCode: 'M9', group: 'io' }],
    inputs: [{ id: 'xmin', type: 'limit', axis: 'x', label: 'X min', pin: 5, level: 0, group: 'io' }],
}));

test('E2 opensAs wiring: I/O Step opens user_io_step IN-PLACE, plain title, twin retired', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const entries = WL.listEntries();
        return {
            opensAs: (entries.find((e) => e.id === 'io_step') || {}).opensAs,
            title: WL.builtinLabelForTwin('user_io_step'),
            twinRetired: !entries.find((e) => e.type === 'user_io_step'),
            registered: !!builderOf('user_io_step'),
        };
    });
    expect(r.opensAs, 'the I/O Step entry opensAs the twin (in-place)').toBe('user_io_step');
    expect(r.title, 'the seamless in-place title is "I/O Step"').toBe('I/O Step');
    expect(r.twinRetired, 'the twin does not surface its OWN data-wiz entry').toBe(true);
    expect(r.registered, 'user_io_step is seeded/registered on boot').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E2 DRIVE (Expert): the mode picker + per-mode fields render; the declared-I/O picker lists names', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { window.__SP = await import('/ui/settingsPanel.js'); });
    await seed(page);
    await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-expert-m350'); });
    await page.evaluate(() => window.openWiz('user_io_step'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);

    const params = () => page.evaluate(() => Array.from(document.querySelectorAll('#wiz_user_form [data-param]')).map((e) => e.getAttribute('data-param')));
    const visibleParams = () => page.evaluate(() => Array.from(document.querySelectorAll('#wiz_user_form [data-param]')).filter((e) => { const row = e.closest('div'); return e.offsetParent !== null; }).map((e) => e.getAttribute('data-param')));

    // OUTPUT mode (default) — the declared-output picker lists "Coolant" + a raw fallback
    const vis = (p) => { const e = document.querySelector(`#wiz_user_form [data-param="${p}"]`); return !!(e && e.offsetParent !== null); };
    const outputMode = await page.evaluate(() => {
        const vis = (p) => { const e = document.querySelector(`#wiz_user_form [data-param="${p}"]`); return !!(e && e.offsetParent !== null); };
        const sel = document.querySelector('#wiz_user_form [data-param="outputRef"]');
        const opts = sel ? Array.from(sel.options).map((o) => o.textContent) : [];
        return { hasPicker: !!sel, opts, hasState: !!document.querySelector('#wiz_user_form [data-param="state"]'), inputGated: (document.querySelector('#wiz_user_form [data-param="mode"] [data-value="input"]') || {}).getAttribute ? document.querySelector('#wiz_user_form [data-param="mode"] [data-value="input"]').getAttribute('data-op-gated') : null, outPinVisible: vis('pin'), waitPinVisible: vis('waitPin'), secVisible: vis('sec') };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/io_step_output.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    // switch to INPUT mode
    await page.click('#wiz_user_form [data-param="mode"] [data-value="input"]');
    await page.waitForTimeout(400);
    const inputMode = await page.evaluate(() => {
        const sel = document.querySelector('#wiz_user_form [data-param="inputRef"]');
        return { hasPicker: !!sel, opts: sel ? Array.from(sel.options).map((o) => o.textContent) : [], hasEdge: !!document.querySelector('#wiz_user_form [data-param="mode2"]'), hasTimeout: !!document.querySelector('#wiz_user_form [data-param="timeout"]') };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/io_step_input.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    // switch to DWELL mode
    await page.click('#wiz_user_form [data-param="mode"] [data-value="dwell"]');
    await page.waitForTimeout(400);
    const dwellMode = await page.evaluate(() => ({ hasSec: !!document.querySelector('#wiz_user_form [data-param="sec"]') }));
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/io_step_dwell.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    const all = await params();
    console.log('IO-STEP IN-PLACE params: ' + all.join(', '));
    console.log('output: ' + JSON.stringify(outputMode) + ' | input: ' + JSON.stringify(inputMode) + ' | dwell: ' + JSON.stringify(dwellMode));
    expect(all.includes('mode'), 'the mode picker renders').toBe(true);
    expect(outputMode.hasPicker && outputMode.opts.some((o) => /Coolant/.test(o)) && outputMode.opts.some((o) => /Raw/.test(o)), 'the declared-output picker lists Coolant + a raw fallback').toBe(true);
    expect(outputMode.hasState, 'the output State toggle renders').toBe(true);
    expect(outputMode.outPinVisible, 'the output raw-pin shows (outputRef=raw default)').toBe(true);
    expect(outputMode.waitPinVisible, 'the INPUT raw-pin does NOT leak into output mode (compound whenAll gate)').toBe(false);
    expect(outputMode.secVisible, 'the dwell field does NOT show in output mode').toBe(false);
    expect(outputMode.inputGated, 'on Expert the Input segment is NOT gated').toBe('off');
    expect(inputMode.hasPicker && inputMode.opts.some((o) => /X min/.test(o)), 'the declared-input picker lists X min').toBe(true);
    expect(inputMode.hasEdge && inputMode.hasTimeout, 'the input Edge + Timeout fields render').toBe(true);
    expect(dwellMode.hasSec, 'the dwell Seconds field renders').toBe(true);
});

test('E2 DRIVE (non-Expert): the INPUT mode greys (data-op-gated) on a V4.1 post', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { window.__SP = await import('/ui/settingsPanel.js'); const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-v41'); });
    await page.evaluate(() => window.openWiz('user_io_step'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
    const gated = await page.evaluate(() => {
        const btn = document.querySelector('#wiz_user_form [data-param="mode"] [data-value="input"]');
        return btn ? { opGated: btn.getAttribute('data-op-gated'), disabled: btn.disabled, tip: btn.title } : null;
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/io_step_input_gated_v41.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-expert-m350'); });
    console.log('non-Expert Input gate: ' + JSON.stringify(gated));
    expect(gated && gated.opGated, 'the Input segment is data-op-gated ON on a non-Expert post').toBe('on');
    expect(gated && gated.disabled, 'the Input segment is disabled on a non-Expert post').toBe(true);
});
