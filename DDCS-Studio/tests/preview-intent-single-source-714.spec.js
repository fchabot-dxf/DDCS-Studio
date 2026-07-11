import { test, expect } from '@playwright/test';

/**
 * t714 (R-A/R-B) — THE ALIGNMENT-SEAT-BUG-CLASS ACCEPTANCE. The class was: a built-in view set a preview intent
 * IMPERATIVELY (previewSeatAtStart/previewMachine/previewToolMachineFrame(true)) that its data-twin set DECLARATIVELY
 * (def.sim → opSimContext), and the two could drift. The fix single-sources it: opSimContext now mirrors each twin's
 * declaration, and BOTH the built-in views AND the twin (userOpView) apply it through the ONE applyPreviewIntent. So the
 * built-in and the twin get the SAME seat/frame/rig/magazine BY CONSTRUCTION. This test locks that: for every migrated op,
 * opSimContext(builtinType) === opSimContext(twinType) — the same declared intent, so the two OPEN paths can't diverge.
 */
test('opSimContext single-sources the built-in type and its twin (same intent → built-in == twin by construction)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    // wait until the data-twins are seeded (their USER_INTENT is registered at boot) so opSimContext(twin) is populated
    await page.waitForFunction(async () => {
        try { const { listUserOps } = await import('/blocks/userOps.js'); return listUserOps().some((d) => d.opType === 'user_alignment_data'); } catch { return false; }
    }, null, { timeout: 15000 });

    const PAIRS = [
        ['alignment', 'user_alignment_data'],       // #3 the exemplar: seatAtStart (+ forceMachine)
        ['rotary_clock', 'user_rotary_clock_data'], // #4 rig + forceMachine
        ['rotary_center', 'user_rotary_center_data'],
        ['atc_change', 'user_atc_change_data'],     // #5 toolMachineFrame + magazine
        ['atc_table', 'user_atc_table_data'],
        ['atc_test', 'user_atc_test_data'],
        ['atc_warmup', 'user_atc_warmup_data'],     // #9 magazine
        ['atc_length', 'user_atc_length_data'],
        ['atc_check', 'user_atc_check_data'],
        ['homing', 'user_homing_data'],
    ];
    const r = await page.evaluate(async (pairs) => {
        const { opSimContext } = await import('/viz/opSimContext.js');
        return pairs.map(([b, t]) => ({ b, t, bi: opSimContext(b), ti: opSimContext(t) }));
    }, PAIRS);

    for (const { b, t, bi, ti } of r) {
        expect(bi, `${b} vs ${t}: the built-in type and its twin declare the SAME preview intent (single-sourced)`).toEqual(ti);
    }
    // spot-check the specific bug-class values the fix targeted:
    const by = Object.fromEntries(r.map((x) => [x.b, x.bi]));
    expect(by.alignment.seatAtStart, 'alignment SEATS at A (the exemplar seat bug, now declared true)').toBe(true);
    expect(by.atc_change.toolMachineFrame, 'atc_change renders the tool in the machine frame (was the wrong frame)').toBe(true);
    expect(by.atc_warmup.showMagazine, 'atc_warmup shows its magazine rack (was missing)').toBe(true);
});
