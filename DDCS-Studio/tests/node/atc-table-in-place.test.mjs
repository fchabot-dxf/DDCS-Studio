import { test, expect } from './support/harness.mjs';

/**
 * ATC-TABLE E2 (t568) — COMPLETES port 3 of 3 AND the WHOLE PORT CAMPAIGN (every wizard is now a data twin). The
 * user_atc_table_data twin is seeded + wired IN-PLACE via the Tool Table slot's `opensAs`. VERIFY: the slot opensAs the twin
 * (plain title, twin retired) · opSimContext carries FORCE_MACHINE + WITH_MAGAZINE.
 *
 * TIER MIGRATION WORK PACKAGE D: moved browser→node. Only this first test moved — plain import()+evaluate over
 * declared registries, no DOM. The file's second test ("DRIVE: ... the two include toggles + the Edit-table button +
 * the live-view emit + the 3D sim") opens the twin via window.openWiz, reads real DOM, and screenshots the panel — a
 * genuine app+DOM dependency, not a candidate for this tier. Split into tests/atc-table-in-place-drive.spec.js. The
 * test explicitly `registerUserOp(atcTableDataDef())`s the twin, since the node tier never runs web/app.js's
 * seedDefaultPortedUserOps() that seeds it in the browser.
 */
const OPTYPE = 'user_atc_table_data';

test('opensAs wiring: Tool Table opens the twin IN-PLACE (plain title, twin retired) + opSimContext machine+magazine', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (OPTYPE) => {
        const WL = await import('/blocks/wizardLibrary.js');
        const { opSimContext } = await import('/viz/opSimContext.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { atcTableDataDef } = await import('/blocks/dataOps/atcTableData.js');
        registerUserOp(atcTableDataDef());   // the node tier never runs web/app.js's seedDefaultPortedUserOps()
        const entries = WL.listEntries();
        const slot = entries.find((e) => e.id === 'atc_table');
        const twinEntry = entries.find((e) => e.type === OPTYPE);
        return { opensAs: slot && slot.opensAs, title: WL.builtinLabelForTwin(OPTYPE), twinRetired: !twinEntry, registered: !!builderOf(OPTYPE), ctx: opSimContext(OPTYPE) };
    }, OPTYPE);
    expect(r.registered, 'the twin is seeded/registered on boot').toBe(true);
    expect(r.opensAs, 'the built-in Tool Table slot opensAs the twin').toBe(OPTYPE);
    expect(r.title, 'the seamless in-place title is the built-in plain label').toBe('Tool Table');
    expect(r.twinRetired, "the twin's own atc_datawiz menu entry is retired").toBe(true);
    expect(r.ctx.forceMachine && r.ctx.showMagazine, 'FORCE_MACHINE + WITH_MAGAZINE carry to the twin').toBe(true);
});
