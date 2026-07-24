import { test, expect } from '@playwright/test';

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
 */

test('native homing (M98 P501) TRIPS the home switch at the seek, then RELEASES on the back-off', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        const { getVirtualInput, resetVirtualIO } = await import('/engine/virtualIO.js');
        resetVirtualIO();
        // Z travel -120 → the span is [-120, 0]; HOME is the machine-0/top end = the MAX end. Fit its home/limit switch on pin 7.
        const s = window.ddcsGetSettings();
        s.machine = { x: 300, y: 200, z: -120, softLimits: true };
        s.homing = { axes: { z: { method: 'native', backoff: 5 } } };
        s.limits = { zMaxPin: 7, zMaxLevel: 0, zMaxSwitchType: 'mechanical' };
        // record IN_HOME_Z on every io_change so we can see the TRIP → RELEASE transition during the run
        const seq = [];
        const rec = () => seq.push(getVirtualInput('IN_HOME_Z'));
        window.addEventListener('io_change', rec);
        const eng = new GcodeExecutionEngine({ autoAnswer: true });
        // start Z MID-TRAVEL (z-50, no switch near) so the trip we see is the HOMING seek, not the initial park
        eng.trace(['G90', 'G0 X0 Y0 Z-50', 'M98P501X2', 'M30'].join('\n'));
        window.removeEventListener('io_change', rec);
        const firstTrip = seq.indexOf(true);
        return {
            homedZ: eng.vars.get(1517),
            tripped: seq.includes(true),
            releasedAfterTrip: firstTrip >= 0 && seq.slice(firstTrip).includes(false),
            finalHome: getVirtualInput('IN_HOME_Z'),
            finalLimit: getVirtualInput('IN_LIMIT_Z_MAX'),
            finalPin7: getVirtualInput('IN_7'),
        };
    });
    expect(r.homedZ, 'the Z homed flag #1517 is set').toBe(1);
    expect(r.tripped, 'IN_HOME_Z TRIPPED as the axis reached the home switch (the seek to machine-0)').toBe(true);
    expect(r.releasedAfterTrip, 'IN_HOME_Z RELEASED after the trip (the back-off cleared the switch)').toBe(true);
    expect(r.finalHome, 'the axis rests BACKED OFF the switch → IN_HOME_Z released at the end').toBe(false);
    expect(r.finalLimit, 'home==limit: IN_LIMIT_Z_MAX tracked IN_HOME_Z and is released at the end').toBe(false);
    expect(r.finalPin7, 'the numbered input pin (7) the switch is wired to is released at the end').toBe(false);
});

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

test.use({ viewport: { width: 1100, height: 800 } });
test('DRIVE THE APP: the io pin LIGHTS when the axis reaches its home/limit switch — screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.ioPanel);
    const lit = await page.evaluate(async () => {
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        const { getVirtualInput, resetVirtualIO } = await import('/engine/virtualIO.js');
        resetVirtualIO();
        const s = window.ddcsGetSettings();
        s.machine = { x: 300, y: 200, z: -120 };
        s.limits = { zMaxPin: 7, zMaxLevel: 0, zMaxSwitchType: 'mechanical' };
        const eng = new GcodeExecutionEngine({ autoAnswer: true });
        // The native home BACKS OFF (releases), so to hold the switch LIT for the shot drive a plain G0 to the Z home
        // edge (machine-0/top) and STOP there — the tool sitting on the switch keeps it tripped.
        eng.trace(['G90', 'G0 X0 Y0 Z-50', 'G0 Z0', 'M30'].join('\n'));
        window.ioPanel.show();   // the live Virtual I/O panel reads ioState → pin-7 LED lights
        return { pin7: getVirtualInput('IN_7'), home: getVirtualInput('IN_HOME_Z'), limit: getVirtualInput('IN_LIMIT_Z_MAX') };
    });
    expect(lit.pin7 && lit.home && lit.limit, 'at the home edge: pin 7 + IN_HOME_Z + IN_LIMIT_Z_MAX are all tripped').toBe(true);
    // a caption so the screenshot reads clearly
    await page.evaluate(() => {
        const c = document.createElement('div'); c.id = 'h3_cap';
        c.style.cssText = 'position:fixed; top:16px; left:16px; right:16px; background:#0f1620; color:#cfe3cf; padding:12px 16px; border:1px solid #34502f; border-radius:8px; z-index:100000; font:14px system-ui;';
        c.textContent = 'HOMING H3 — the tool at its Z home edge (machine-0): the home switch (wired to input pin 7) is TRIPPED, so its Virtual I/O LED is lit.';
        document.body.appendChild(c);
    });
    // t1133 flake-harden — await the LED actually rendering LIT (the real condition), not a fixed 350ms that samples before
    // the io panel repaints under 4-worker gate contention. If the LED never lights, this times out = a real bug, not masked.
    await page.waitForFunction(() => { const b = document.querySelector('#io-panel .io-input[data-pin="7"]'); return !!(b && b.classList.contains('active')); }, null, { timeout: 6000 });
    const ledLit = await page.evaluate(() => { const b = document.querySelector('#io-panel .io-input[data-pin="7"]'); return b ? b.classList.contains('active') : null; });
    expect(ledLit, 'the pin-7 input LED renders LIT (.active) in the live I/O panel').toBe(true);
    await page.screenshot({ path: 'scratchpad/homing_h3_switch_lit.png' });
});
