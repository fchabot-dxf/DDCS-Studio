import { test, expect } from './support/harness.mjs';

/**
 * ATC TEST E2 (t560) — COMPLETES port 1 of 3. The user_atc_test_data twin is seeded + wired IN-PLACE via the built-in ATC
 * Test slot's `opensAs`. VERIFY: the slot opensAs the twin (plain title, twin retired) · opSimContext carries FORCE_MACHINE +
 * WITH_MAGAZINE + the machine-frame intent.
 *
 * TIER MIGRATION WORK PACKAGE D: moved browser→node. Only this first test moved — plain import()+evaluate over
 * declared registries, no DOM. The file's second test ("DRIVE: ... both modes render their fields + the emit preview
 * + the machine+magazine 3D sim") opens the twin via window.openWiz, reads real DOM, clicks a segmented-control
 * button, and screenshots the panel — a genuine app+DOM dependency, not a candidate for this tier. Split into
 * tests/atc-test-in-place-drive.spec.js. The test explicitly `registerUserOp(atcTestDataDef())`s the twin, since the
 * node tier never runs web/app.js's seedDefaultPortedUserOps() that seeds it in the browser.
 */
const OPTYPE = 'user_atc_test_data';

test('opensAs wiring: ATC Test opens the twin IN-PLACE (plain title, twin retired) + opSimContext carries machine+magazine', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (OPTYPE) => {
        const WL = await import('/blocks/wizardLibrary.js');
        const { opSimContext } = await import('/viz/opSimContext.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { atcTestDataDef } = await import('/blocks/dataOps/atcTestData.js');
        registerUserOp(atcTestDataDef());   // the node tier never runs web/app.js's seedDefaultPortedUserOps()
        const entries = WL.listEntries();
        const slot = entries.find((e) => e.id === 'atc_test');
        const twinEntry = entries.find((e) => e.type === OPTYPE);
        return { opensAs: slot && slot.opensAs, title: WL.builtinLabelForTwin(OPTYPE), twinRetired: !twinEntry, registered: !!builderOf(OPTYPE), ctx: opSimContext(OPTYPE) };
    }, OPTYPE);
    expect(r.registered, 'the twin is seeded/registered on boot').toBe(true);
    expect(r.opensAs, 'the built-in ATC Test slot opensAs the twin').toBe(OPTYPE);
    expect(r.title, 'the seamless in-place title is the built-in plain label').toBe('ATC Test');
    expect(r.twinRetired, "the twin's own atc_datawiz menu entry is retired (no duplicate slot)").toBe(true);
    expect(r.ctx.forceMachine, 'FORCE_MACHINE membership carries → the sim forces the envelope').toBe(true);
    expect(r.ctx.showMagazine, 'WITH_MAGAZINE membership carries → the sim renders the magazine').toBe(true);
    expect(r.ctx.toolMachineFrame, 'the machine-frame intent carries (atc_test is a G53 machine op, like homing)').toBe(true);
});
