import { test, expect } from '@playwright/test';

/**
 * SYSSTART GENERATE NOW HOMES (t626). The Macros → sysstart Generate/Push used to call homingStack(settings.homing) — the
 * WRONG shape (settings.homing.axes is an OBJECT; homingStack needs an ordered ARRAY + config) — so it emitted the empty
 * "(none)/No axes selected" stub: the boot macro has NEVER homed. Fixed via the ONE shared contract helper homingRunParams,
 * called by BOTH the wizard (homingView) and the sysstart Generate, so they can't drift. This asserts the VALUE: the
 * generated sysstart now carries the REAL G31 sequence, byte-equal to the wizard emit (the independent truth); an
 * all-disabled config still produces the honest stub; the advstart/sysstart filename decision is unchanged.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const SETTINGS = {
    machine: { x: 600, y: 400, z: 500, softLimits: true },
    limits: { zMaxHome: true, xMinHome: true, yMinHome: true },
    homing: { philosophy: 'sequential', axes: {
        z: { enable: true, order: 1, method: 'seek', seekFeed: 600 },
        x: { enable: true, order: 2, method: 'seek', seekFeed: 800 },
        y: { enable: true, order: 3, method: 'seek', seekFeed: 800 },
    } },
};

test('homingRunParams drives the REAL homing sequence, byte-equal to the wizard emit; an all-disabled config → the stub', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (S) => {
        const { homingStack, homingRunParams } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        // the SYSSTART path (no explicit selection → the enabled configured axes)
        const sysstartParams = homingRunParams(S);
        const sysstart = emitMapped(homingStack(sysstartParams)).text;
        // the WIZARD path (the per-run ticks default to the enabled axes → the SAME selection)
        const wizardParams = homingRunParams(S, { selected: ['z', 'x', 'y'] });
        const wizard = emitMapped(homingStack(wizardParams)).text;
        // all-disabled config → the honest stub
        const disabled = { ...S, homing: { philosophy: 'sequential', axes: { z: { enable: false }, x: { enable: false }, y: { enable: false } } } };
        const stub = emitMapped(homingStack(homingRunParams(disabled))).text;
        return { axes: sysstartParams.axes, sysstart, wizard, stub };
    }, SETTINGS);
    // ordered enabled axes
    expect(r.axes, 'the enabled axes, ordered by .order').toEqual(['z', 'x', 'y']);
    // the REAL G31 seek sequence (not the stub) — per-axis, with the configured feeds
    expect(r.sysstart, 'Z homes with its 600 seek feed').toMatch(/G31 Z\S+ F600/);
    expect(r.sysstart, 'X homes with its 800 seek feed').toMatch(/G31 X\S+ F800/);
    expect(r.sysstart).toMatch(/G31 Y\S+ F800/);
    expect(r.sysstart, 'no longer the empty stub').not.toMatch(/No axes selected to home/);
    // BYTE-EQUAL to the wizard emit (the independent truth) — the two paths share homingRunParams, so they can't diverge
    expect(r.sysstart, 'sysstart emit == the wizard emit for the same config').toBe(r.wizard);
    // all-disabled → the honest stub, no motion
    expect(r.stub, 'all-disabled config → the honest stub').toMatch(/No axes selected to home/);
    expect(r.stub).not.toMatch(/G31/);
});

test('the Macros → sysstart REGENERATE rebuilds the real homing sequence into the STORED body (t656 real-symptom drive)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.showApp);
    await page.evaluate((S) => { Object.assign(window.ddcsGetSettings(), S); }, SETTINGS);
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForFunction(() => window.showMacrosPanel, null, { timeout: 8000 });
    await page.evaluate(() => window.showMacrosPanel('macros_panel_sysstart'));
    await page.waitForTimeout(200);
    page.on('dialog', (d) => d.accept());   // any clobber-confirm → accept (a fresh seed isn't hand-edited, so usually none)
    await page.click('#sysstart_regen');
    await page.waitForTimeout(200);
    const out = await page.evaluate(() => (document.getElementById('sysstart_body') || {}).value || '');
    expect(out, 'the regenerated body carries the real G31 homing sequence, not the stub').toMatch(/G31 Z\S+ F600/);
    expect(out).toMatch(/G31 X\S+ F800/);
    expect(out).not.toMatch(/No axes selected to home/);
    expect(out, 'still wraps with M30').toMatch(/M30/);
    // t656 — the regenerated body is STORED (the editor is the source of truth; Push sends exactly this)
    const stored = await page.evaluate(() => window.ddcsGetSettings().autostartBody);
    expect(stored, 'the body is stored in settings.autostartBody').toBe(out);
    // the homing-summary section is GONE from the panel (dropped)
    const gone = await page.evaluate(() => !document.getElementById('sysstart_homing_summary') && !document.getElementById('sysstart_gen') && !document.getElementById('sysstart_out'));
    expect(gone, 'the homing-summary section + the old Generate/output are removed').toBe(true);
});
