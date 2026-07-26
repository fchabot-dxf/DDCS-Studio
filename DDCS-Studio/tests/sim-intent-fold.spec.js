import { test, expect } from '@playwright/test';

/**
 * PREVIEW-PARITY E3 (t590) — the OVERRIDE FOLD. A "machine-frame op" (toolMachineFrame) used to declare THREE coupled
 * flags: forceMachine (draw the envelope) + toolMachineFrame (machine-coords tool) + seatAtStart (seat at the Start).
 * They express ONE concept, so opSimContext now DERIVES forceMachine + seatAtStart FROM toolMachineFrame — an op declares
 * the machine-frame intent ONCE. This locks the derivation for both built-ins (homing) and user twins (declare only
 * toolMachine → get all three), and confirms the standalone intents (ATC forceMachine, alignment seatAtStart) still stand.
 */
test('opSimContext: toolMachineFrame IMPLIES forceMachine + seatAtStart (one intent, not three flags)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const { opSimContext, setUserSimIntent } = await import('/viz/opSimContext.js');
        // a user op declaring ONLY the machine-frame-tool intent → forceMachine + seatAtStart derive
        setUserSimIntent('__test_mf_only', { toolMachineFrame: true });
        // a user op declaring ONLY forceMachine (an ATC-style op) → no toolMachineFrame, no seatAtStart
        setUserSimIntent('__test_force_only', { forceMachine: true });
        // a user op declaring ONLY seatAtStart (an alignment-style probe) → seat without the machine frame
        setUserSimIntent('__test_seat_only', { seatAtStart: true });
        const out = {
            mfOnly: opSimContext('__test_mf_only'),
            forceOnly: opSimContext('__test_force_only'),
            seatOnly: opSimContext('__test_seat_only'),
            homing: opSimContext('homing'),   // built-in — the same derivation
            atcLength: opSimContext('atc_length'),   // built-in ATC — forceMachine only
            mill: opSimContext('pocket'),   // a plain op — all false
        };
        setUserSimIntent('__test_mf_only', null); setUserSimIntent('__test_force_only', null); setUserSimIntent('__test_seat_only', null);
        return out;
    });
    // the fold: declaring toolMachineFrame alone yields all three
    expect(r.mfOnly).toEqual({ showRotaryRig: false, forceMachine: true, showMagazine: false, toolMachineFrame: true, seatAtStart: true, probesForWcs: false });
    // the standalone intents survive as declared exceptions
    expect(r.forceOnly.forceMachine, 'ATC-style: forceMachine without the machine-frame tool').toBe(true);
    expect(r.forceOnly.toolMachineFrame).toBe(false);
    expect(r.forceOnly.seatAtStart).toBe(false);
    expect(r.seatOnly.seatAtStart, 'alignment-style: seat without the machine frame').toBe(true);
    expect(r.seatOnly.forceMachine).toBe(false);
    expect(r.seatOnly.toolMachineFrame).toBe(false);
    // built-in homing — the machine-frame op, all three derive from the one intent
    expect(r.homing).toEqual({ showRotaryRig: false, forceMachine: true, showMagazine: false, toolMachineFrame: true, seatAtStart: true, probesForWcs: false });
    // built-in ATC length — forceMachine only (a G53 op, but not a machine-frame TOOL render)
    expect(r.atcLength.forceMachine).toBe(true);
    expect(r.atcLength.toolMachineFrame).toBe(false);
    expect(r.atcLength.seatAtStart).toBe(false);
    // a plain op — nothing forced
    expect(r.mill).toEqual({ showRotaryRig: false, forceMachine: false, showMagazine: false, toolMachineFrame: false, seatAtStart: false, probesForWcs: false });
});
