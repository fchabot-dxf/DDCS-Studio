import { test, expect } from './support/harness.mjs';

/**
 * HOMING H3 — the LIVE trip model wired into the execution engine (SIM-ONLY; emit BYTE-IDENTICAL).
 *
 * The trip MODEL (engine/limitSwitches.js `limitSwitchTrips`) + the switch-type standoff (H2) already existed and were
 * unit-tested, but GcodeExecutionEngine never CALLED them — so IN_LIMIT_* / IN_HOME_* stayed dead during a run. H3 wires
 * `setLimitSwitches(limitSwitchTrips(machinePos, machine, settings.limits))` at every position-commit point (trace +
 * real-time; linear / arc / homing), computing MACHINE coords from the PART-frame this.pos via the G53 map
 * (machine = (part + wcsOffset) / unitScale). The M98-P501 native handler now models the real O501 motion — SEEK the
 * home switch (machine-0 end) then BACK OFF — so the home switch TRIPS at the seek and RELEASES on the back-off, exactly
 * like homingSimProxy's G53 seek/back. VERIFY (assert-the-value + real-symptom): the home switch trips + releases during
 * homing, a non-homing run that reaches a limit trips, the proximity standoff is respected through the engine, emit is
 * byte-identical, and the io pin LIGHTS in the live panel (screenshot).
 *
 * t2695 — TIER MIGRATION BATCH 5: moved browser→node. Two tests stayed, not the one the dispatch expected:
 * "DRIVE THE APP..." (a real `window.ioPanel.show()` render + a live `#io-panel` LED's CSS class) as expected,
 * PLUS "native homing...TRIPS..." — MEASURED, not assumed: it failed on first run here (`r.tripped` came back
 * false) because it registers a REAL `window.addEventListener('io_change', ...)` listener and expects
 * `dispatchEvent` to actually invoke it mid-trace, observing the trip→release SEQUENCE over time — but
 * register.mjs's own event-bus stub is DELIBERATELY inert (`dispatchEvent = () => true`, never calling
 * listeners) — its own header names this as the point, not an oversight ("nothing in this tier ever fires an
 * event... the emit under test must not depend on having been poked"). Not a bug to route around; a genuine
 * "needs more than the stub, not a candidate for this tier" case, same doctrine as the real-DOM/real-render
 * findings in prior batches. Split alongside the DRIVE test into tests/homing-limit-trip-drive.spec.js. The
 * remaining 3 tests here check only FINAL state via `getVirtualInput()` after `trace()` returns — no event
 * subscription needed — and are genuinely pure.
 */

test('a NON-homing run that reaches a limit ALSO trips (the model is live generally, not just for homing)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        const { getVirtualInput, resetVirtualIO } = await import('/engine/virtualIO.js');
        resetVirtualIO();
        const s = window.ddcsGetSettings();
        s.machine = { x: 300, y: 200, z: -120 };
        s.limits = { xMaxPin: 9, xMaxLevel: 0, xMaxSwitchType: 'mechanical' };   // the +X FAR edge (300) — NOT the home end
        const eng = new GcodeExecutionEngine({ autoAnswer: true });
        // a plain rapid to the +X envelope edge (machine 300) — no homing macro at all
        eng.trace(['G90', 'G0 X0 Y0 Z0', 'G0 X300', 'M30'].join('\n'));
        return { limitXmax: getVirtualInput('IN_LIMIT_X_MAX'), homeX: getVirtualInput('IN_HOME_X'), pin9: getVirtualInput('IN_9') };
    });
    expect(r.limitXmax, 'a plain G0 to the X envelope edge trips IN_LIMIT_X_MAX (no homing needed)').toBe(true);
    expect(r.pin9, 'the numbered input pin (9) the limit switch is wired to lights').toBe(true);
    expect(r.homeX, 'X home is the machine-0/MIN end, so the +X MAX edge is a LIMIT only, not the home switch').toBe(false);
});

test('the proximity standoff is respected THROUGH the engine (a proximity switch trips Sn before the edge; mechanical at it)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings);
    const probe = (switchType) => page.evaluate(async (st) => {
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        const { getVirtualInput, resetVirtualIO } = await import('/engine/virtualIO.js');
        resetVirtualIO();
        const s = window.ddcsGetSettings();
        s.machine = { x: 300, y: 200, z: -120 };
        s.limits = { xMaxPin: 9, xMaxLevel: 0, xMaxSwitchType: st };
        const eng = new GcodeExecutionEngine({ autoAnswer: true });
        // drive X to 298 = 2 mm SHORT of the +X edge (300): within Sn=3 for a proximity sensor, outside for a mechanical one
        eng.trace(['G90', 'G0 X0 Y0 Z0', 'G0 X298', 'M30'].join('\n'));
        return getVirtualInput('IN_LIMIT_X_MAX');
    }, switchType);
    const prox = await probe('proximity');
    const mech = await probe('mechanical');
    expect(prox, 'a PROXIMITY switch trips 2 mm from the edge (within its Sn=3 standoff)').toBe(true);
    expect(mech, 'a MECHANICAL switch does NOT trip 2 mm from the edge (it trips AT the edge)').toBe(false);
});

test('emit BYTE-IDENTICAL — the H3 trip model is sim-only and does not touch the emitted homing macro', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const emit = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        return emitMapped(homingStack({ axes: ['z'], config: { z: { method: 'native' } }, machine: { z: -120 } })).text;
    });
    expect(emit.includes('G31'), 'the wizard homing emit is G31 (t536 — the saved native is ignored for a linear axis)').toBe(true);
    expect(/IN_LIMIT|IN_HOME|limitSwitch|setLimitSwitch|switchType|standoff/i.test(emit), 'the emitted macro references NO limit/home switch IO (the trip model is sim-only)').toBe(false);
});
