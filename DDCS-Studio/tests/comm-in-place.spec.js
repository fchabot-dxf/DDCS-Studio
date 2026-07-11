import { test, expect } from '@playwright/test';

/**
 * Comm/MDI PORT 1b-ii E3 — the IN-PLACE milestone (opensAs + seamless title + seed), completes the Setup/IO Comm port. The
 * built-in Comm slot re-points to the twin user_comm_data via ONE `opensAs`; the twin's own data-wiz entry auto-hides; the
 * twin is seeded on boot. VERIFY: (1) the click re-points + seamless title + twin retired; (2) the in-place FORM renders the
 * comm fields; (3) the 'commscreen' panel renders the live DDCS-screen preview (popup/status/input mock), NOT the legacy modal.
 */

test('E3 opensAs wiring: Comm opens user_comm_data IN-PLACE, plain title, twin retired', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        const entries = WL.listEntries();
        const comm = entries.find((e) => e.id === 'comm');
        const twinEntry = entries.find((e) => e.type === 'user_comm_data');
        const { builderOf } = await import('/blocks/opBuilders.js');
        return {
            opensAs: comm && comm.opensAs,
            title: WL.builtinLabelForTwin('user_comm_data'),
            twinRetired: !twinEntry,
            registered: !!builderOf('user_comm_data'),
        };
    });
    expect(r.opensAs, 'the built-in Comm entry opensAs the twin (the click re-points in-place)').toBe('user_comm_data');
    expect(r.title, 'the seamless in-place title is the built-in plain label "Comm / MDI"').toBe('Comm / MDI');
    expect(r.twinRetired, 'the twin no longer surfaces its OWN data-wiz entry (one-source hide)').toBe(true);
    expect(r.registered, 'user_comm_data is seeded/registered on boot').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('E3 DRIVE: Comm opens IN-PLACE — the comm fields render + the DDCS-screen preview shows (not the legacy modal)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('user_comm_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);

    const form = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
        const host = document.querySelector('#wiz_user .comm-screen-host');
        return {
            fieldCount: params.length, params,
            hasType: params.includes('type'), hasMsg: params.includes('msg'), hasPopupMode: params.includes('popupMode'),
            previewHostPresent: !!host,
            previewHasDialog: !!(host && host.querySelector('.comm-dialog')),
            previewShown: !!(host && getComputedStyle(host).display !== 'none'),
            legacyModalHidden: (() => { const m = document.getElementById('wiz_comm'); return !m || getComputedStyle(m).display === 'none'; })(),
        };
    });

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/comm_e3_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    console.log('E3 IN-PLACE FORM: ' + form.fieldCount + ' fields → ' + form.params.join(', ') + ' | ' + JSON.stringify({ previewHasDialog: form.previewHasDialog, legacyModalHidden: form.legacyModalHidden }));
    expect(form.fieldCount, 'the in-place form is NOT empty').toBeGreaterThan(3);
    expect(form.hasType && form.hasMsg && form.hasPopupMode, 'the type / msg / popupMode comm knobs render').toBe(true);
    expect(form.previewHostPresent && form.previewShown, 'the DDCS-screen preview host renders (commscreen panel, not an empty 3D pane)').toBe(true);
    expect(form.previewHasDialog, 'the DDCS-screen preview shows the controller dialog mock (popup)').toBe(true);
    expect(form.legacyModalHidden, 'the LEGACY Comm modal (#wiz_comm) does NOT open (in-place, not the old modal)').toBe(true);
});
