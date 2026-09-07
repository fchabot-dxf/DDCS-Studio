import { test, expect } from './support/harness.mjs';

/**
 * ATC CHANGE E2 (t566) — COMPLETES port 2 of 3. The user_atc_change_data twin is seeded + wired IN-PLACE via the Tool Change
 * slot's `opensAs`. VERIFY: the slot opensAs the twin (plain title, twin retired) · opSimContext carries FORCE_MACHINE +
 * WITH_MAGAZINE + the machine-frame intent · the choreography sim-gcode override for the automatic methods.
 *
 * TIER MIGRATION WORK PACKAGE D: moved browser→node. Only this first test moved — plain import()+evaluate over
 * declared registries/functions, no DOM. The file's second test ("DRIVE: ... the per-method field gating ... + the 3D
 * sim") opens the twin via window.openWiz, reads real DOM (getComputedStyle, data-op-gated attrs), dispatches change
 * events on real form elements, and screenshots the panel — a genuine app+DOM dependency, not a candidate for this
 * tier. Split into tests/atc-change-in-place-drive.spec.js. The test explicitly `registerUserOp(atcChangeDataDef())`s
 * the twin, since the node tier never runs web/app.js's seedDefaultPortedUserOps() that seeds it in the browser.
 */
const OPTYPE = 'user_atc_change_data';

test('opensAs wiring: Tool Change opens the twin IN-PLACE (plain title, twin retired) + opSimContext + the choreography hook', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (OPTYPE) => {
        const WL = await import('/blocks/wizardLibrary.js');
        const { opSimContext } = await import('/viz/opSimContext.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { getUserSimGcode, registerUserOp } = await import('/blocks/userOps.js');
        const { atcChangeDataDef } = await import('/blocks/dataOps/atcChangeData.js');
        registerUserOp(atcChangeDataDef());   // the node tier never runs web/app.js's seedDefaultPortedUserOps()
        const entries = WL.listEntries();
        const slot = entries.find((e) => e.id === 'atc_change');
        const twinEntry = entries.find((e) => e.type === OPTYPE);
        // the choreography hook: auto method → a non-null sim gcode; m6 → null (preview the emit's own moves)
        window.__atcS = { atc: { magazine: [{ tool: 1, x: 100, y: 50, z: -20, pocket: 1 }], grip: 'drawbar', motion: 'pick-place', layout: 'linear', safeZ: 10 }, outputs: [{ type: 'drawbar', onCode: 'M154', offCode: 'M155' }], inputs: [] };
        window.ddcsGetSettings = () => window.__atcS;
        const sg = getUserSimGcode(OPTYPE);
        return { opensAs: slot && slot.opensAs, title: WL.builtinLabelForTwin(OPTYPE), twinRetired: !twinEntry, registered: !!builderOf(OPTYPE), ctx: opSimContext(OPTYPE), autoSim: sg ? !!sg({ method: 'generic', callMacro: false }) : false, m6Sim: sg ? sg({ method: 'm6' }) : 'no-hook' };
    }, OPTYPE);
    expect(r.registered, 'the twin is seeded/registered on boot').toBe(true);
    expect(r.opensAs, 'the built-in Tool Change slot opensAs the twin').toBe(OPTYPE);
    expect(r.title, 'the seamless in-place title is the built-in plain label').toBe('Tool Change');
    expect(r.twinRetired, "the twin's own atc_datawiz menu entry is retired").toBe(true);
    expect(r.ctx.forceMachine && r.ctx.showMagazine && r.ctx.toolMachineFrame, 'FORCE_MACHINE + WITH_MAGAZINE + machine-frame carry').toBe(true);
    expect(r.autoSim, 'the choreography hook returns a sim gcode for an AUTOMATIC method').toBe(true);
    expect(r.m6Sim, 'm6 → null (the real emit’s own moves animate)').toBe(null);
});
