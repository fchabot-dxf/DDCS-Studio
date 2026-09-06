import { test, expect } from './support/harness.mjs';

/**
 * SYSSTART GENERATE NOW HOMES (t626). The Macros → sysstart Generate/Push used to call homingStack(settings.homing) — the
 * WRONG shape (settings.homing.axes is an OBJECT; homingStack needs an ordered ARRAY + config) — so it emitted the empty
 * "(none)/No axes selected" stub: the boot macro has NEVER homed. Fixed via the ONE shared contract helper homingRunParams,
 * called by BOTH the wizard (homingView) and the sysstart Generate, so they can't drift. This asserts the VALUE: the
 * generated sysstart now carries the REAL G31 sequence, byte-equal to the wizard emit (the independent truth); an
 * all-disabled config still produces the honest stub; the advstart/sysstart filename decision is unchanged.
 *
 * t2695 — TIER MIGRATION BATCH 5: moved browser→node. ONLY the first test moved — pure `homingStack`/
 * `homingRunParams`/`emitMapped`, no DOM. The file's 2nd test ("the Macros → sysstart REGENERATE...") drives the
 * real Macros panel (a click, a real `#sysstart_body` textarea read) — a genuine app+DOM dependency. Split into
 * tests/homing-sysstart-real-regenerate.spec.js, left in the browser tier.
 */
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
