import { test, expect } from './support/harness.mjs';

/**
 * ALIGNMENT sim-start fix (t570) — the human's symptom: the played trace + the point-A probe rendered AT {0,0} (the circled
 * origin probe) while the A/B handles sat elsewhere, so the drawn path was disconnected from the handles. Since the revised
 * AUTO probes A IN PLACE, the sim's "in place" = the engine's initial seat = origin. FIX (reuse the homing t540 initialPos
 * seam via a declared seatStart intent): seat the trace/engine INITIAL POSITION at marker A, so the drawn path BEGINS at A
 * (probe A at A → the span jog lands at B → the path connects the handles). Emit unchanged (sim-only).
 *
 * t2694 — TIER MIGRATION WORK PACKAGE 4: split from alignment-sim-starts-at-a.spec.js. This file keeps the FIRST test
 * only — pure page.goto + page.evaluate importing opSimContext.js, no DOM. `opSimContext('user_alignment_data')` reads
 * a declared intent registered by `registerUserOp` (via userOps.js's `setUserSimIntent`, resolved from the alignment
 * data-def's `preview3d` template block); the real app pre-seeds this at boot (seedDefaultPortedUserOps(), web/app.js)
 * — the node tier's page.goto stub only imports settingsPanel.js, so this test registers the def itself first (the
 * established "seed what full app boot would have provided" pattern used elsewhere for builderOf/createUserOp).
 * The SECOND test ("the played trace STARTS at handle A") opens a real wizard (window.openWiz), waits on a real DOM
 * selector + a rendered canvas, and reads a live wizardManager panel's getSegments/getPassStarts — a genuine
 * app+DOM+render dependency, not a candidate for this tier. It stays in tests/alignment-sim-starts-at-a-drive.spec.js.
 */
test.use({ viewport: { width: 1300, height: 950 } });

test('the alignment intent carries seatAtStart (the declared sim{seatStart} → opSimContext)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const ctx = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { alignmentDataDef } = await import('/blocks/dataOps/alignmentData.js');
        uo.registerUserOp(alignmentDataDef());   // node tier: page.goto doesn't run seedDefaultPortedUserOps() (web/app.js)
        const { opSimContext } = await import('/viz/opSimContext.js');
        return opSimContext('user_alignment_data');
    });
    expect(ctx.seatAtStart, 'the alignment twin declares seatStart → opSimContext.seatAtStart').toBe(true);
    expect(ctx.toolMachineFrame, 'but NOT the machine-frame tool render (alignment is a local/part-frame probe)').toBe(false);
});
