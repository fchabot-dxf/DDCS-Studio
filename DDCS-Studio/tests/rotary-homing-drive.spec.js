import { test, expect } from '@playwright/test';

/**
 * ROTARY HOMING — DRIVE SPLIT (tier migration). These 3 tests stayed in the browser tier:
 *  - "dual-Y exclusivity" and "the SIM rotary map is populated" are pure data-computation checks by body, but the
 *    node tier's `window.ddcsGetSettings()` is a MODULE SINGLETON that survives across tests within one process
 *    (the node harness's `page.goto()` is a documented no-op — it does not reload/reset the module graph the way
 *    a real page navigation does). Both tests here read state a PRIOR test in the same file mutated (a leftover
 *    `s.__sel`, and a prior test's monkey-patch of `window.ddcsGetSettings` itself) — a divergence CONFIRMED by
 *    running the unmodified originals in real Playwright (both pass there) vs the node conversion (both failed
 *    there, for exactly that reason). See tests/node/rotary-homing.test.mjs for the 3 tests that DID convert
 *    cleanly (switch-seek arm, no-declared-dir/set-zero/linear, the data-twin recompose).
 *  - "REAL APP: the method select renders..." drives real DOM (`window.openSettings`, `page.waitForSelector`,
 *    `document.querySelectorAll`) — a genuine browser-tier test regardless.
 */

const emitFor = (page, mutate) => page.evaluate(async (mut) => {
    const { homingStack, homingRunParams } = await import('/wizards/homingWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { activeDialectOpts } = await import('/wizards/previewEmit.js');
    const s = window.ddcsGetSettings();
    // eslint-disable-next-line no-new-func
    (new Function('s', mut))(s);
    return emitMapped(homingStack(homingRunParams(s, s.__sel ? { selected: s.__sel } : {}), {}), activeDialectOpts()).text || '';
}, mutate);

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.showApp);
});

test('dual-Y exclusivity: a SLAVE-role axis is never seek/set-zero-homed (no A arm, no #883 clash)', async ({ page }) => {
    const slaveA = await emitFor(page, `
        s.motors.a = { role:'slave', follows:'y' };   // A is a gantry slave, NOT rotary → default derivation excludes it
        s.homing = { philosophy:'sequential', axes:{ a:{ rotary:'seek', enable:true }, y:{ enable:true } } };
        s.limits.aHomeDir = 'pos'; s.machine.y = 400; s.limits.yMaxHome = true;`);
    // A must NOT get its own home arm (homingRunParams excludes a slave role); Y's homing syncs it instead
    expect(slaveA, 'no independent A rotary seek arm for a slave axis').not.toContain('G31 A');
    expect(slaveA, 'the A slave is synced from its master (fndzero tail), not homed').toMatch(/G31 Y/);
});

test('the SIM rotary map is populated for a rotary axis (the homing preview spins A on the emitted A move)', async ({ page }) => {
    const rax = await page.evaluate(async () => {
        window.ddcsGetSettings().motors.a = { role: 'rotary', around: 'x' };
        const { getRotaryAxes } = await import('/ui/settingsPanel.js');
        return getRotaryAxes();
    });
    expect(rax.a, 'motors.a=rotary → getRotaryAxes maps A around X → the emitted G31 A move spins the part in the preview').toBe('x');
});

test('REAL APP: the method select renders for rotary ONLY; the rotary home I/O row syncs aHomeDir', async ({ page }) => {
    await page.waitForFunction(() => window.openSettings);
    await page.evaluate(async () => {
        const s = window.ddcsGetSettings();
        s.motors.a = { role: 'rotary', around: 'x' };
        s.homing = { philosophy: 'sequential', axes: { a: { rotary: 'seek', enable: true } } };
        // declare a rotary home switch in the I/O inputs, then re-sync the flat limits (the ONE source homing reads)
        s.inputs = (s.inputs || []).filter((r) => r.type !== 'home');
        s.inputs.push({ id: 'home_a', type: 'home', label: 'A home', axis: 'a', dir: 'pos', pin: 7, level: 0 });
        const { syncIO } = await import('/ui/settingsPanel.js');
        syncIO();
    });
    // open Machine → Homing and assert the rotary method select renders for A, and NOT for X
    await page.evaluate(() => window.openSettings({ group: 'hardware', panel: 'set_tab_machine' }));
    await page.waitForSelector('#set_homing_axes .homing-axis-row', { timeout: 8000 });
    const ui = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#set_homing_axes .homing-axis-row')];
        const rowOf = (ax) => rows.find((r) => r.getAttribute('data-axis') === ax);
        const a = rowOf('a'), x = rowOf('x');
        return {
            aHasSelect: !!(a && a.querySelector('.hm-rotmode')),
            xHasSelect: !!(x && x.querySelector('.hm-rotmode')),
            aHomeDir: window.ddcsGetSettings().limits.aHomeDir,
        };
    });
    expect(ui.aHasSelect, 'rotary A shows the Set-zero|Switch-seek method select').toBe(true);
    expect(ui.xHasSelect, 'linear X keeps the fixed method text (no select)').toBe(false);
    expect(ui.aHomeDir, 'the rotary home I/O row synced its direction to settings.limits.aHomeDir').toBe('pos');
});
