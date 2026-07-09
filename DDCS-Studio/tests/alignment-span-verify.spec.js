import { test, expect } from '@playwright/test';

/**
 * t544 ALIGNMENT AUTO REVISION — the real-app close-out checks + screenshots. TYPING the span moves handle B (the ONE
 * source: field ↔ drag); the AUTO emit = probe A in place + a relative checkAxis jog of exactly the span. Screenshots: the
 * 2 handles + span field, and the AUTO emit (the code panel showing probe-A-in-place + the span jog).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('typing the A→B span moves handle B (one source: field ↔ marker) + the AUTO emit is probe-A-in-place + a span jog', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true } }); });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form [data-param="span"]', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('#userVizContainer [data-hid="__simstart1"]'), null, { timeout: 8000 });
    await page.waitForTimeout(200);

    // marker B's world position for a given span (opSimStarts — the ONE source the canvas reads)
    const markBx = async () => page.evaluate(async () => {
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { getLastOp } = await import('/blocks/opRecord.js');
        const s = opSimStarts('user_alignment_data', getLastOp().params, window.ddcsGetSettings().stock) || [];
        return s[1] ? s[1].x : null;
    });

    // TYPE span = 30 → B is 30mm from A along X; then span = 90 → B moves 60mm further (the marker TRACKS the field)
    await page.fill('#wiz_user_form [data-param="span"]', '30');
    await page.dispatchEvent('#wiz_user_form [data-param="span"]', 'change');
    await page.waitForTimeout(200);
    const b30 = await markBx();
    await page.fill('#wiz_user_form [data-param="span"]', '90');
    await page.dispatchEvent('#wiz_user_form [data-param="span"]', 'change');
    await page.waitForTimeout(200);
    const b90 = await markBx();
    expect(Number.isFinite(b30) && Number.isFinite(b90), 'marker B resolves for both spans').toBe(true);
    expect(b90 - b30, 'typing span 30→90 moves marker B +60mm along X (the field drives the marker)').toBeCloseTo(60, 0);

    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/alignment_span_handles_form.png' });

    // the AUTO emit: probe A IN PLACE (no travel/Confirm) + the relative span jog (#73) to B
    const emit = await page.evaluate(async () => {
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        return emitMapped(alignmentStack({ checkAxis: 'X', span: 90 })).text;
    });
    expect(emit).toContain('probe point A in place');
    expect(emit).toContain('REPOSITION: auto-traverse the declared span');
    expect(emit).toMatch(/#73\s*=\s*90/);
    expect(emit).toContain('G0 X#73');
    expect(emit).not.toContain('Press Enter when in position');
});
