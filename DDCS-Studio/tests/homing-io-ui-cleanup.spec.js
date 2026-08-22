import { test, expect } from '@playwright/test';

/**
 * t538 UI cleanup — (1) the homing run-row chips show the WIZARD method (G31 switch-seek), NOT a stale saved 'native';
 * (3) the I/O-step Input Result-var/Timeout (M66-only) are HIDDEN on a DDCS post, SHOWN on RS274/grblHAL (dialect-aware).
 */
test.use({ viewport: { width: 1300, height: 950 } });

// t1730 — the homing coded view (homingView.js) that rendered `.homing-run-ax` checkboxes with a derived
// method-label <span> (switch-seek/set-zero/native) is DELETED. The twin's run-form (homingData.js
// HOMING_STRUCT_BINDINGS) is plain boolean ticks (run_z/run_x/run_y/run_a/run_b) with STATIC labels ("Home Z")
// — there is no per-axis derived-method chip to assert against in the twin. No clean equivalent; not guessing.
test.fixme('(1) homing run-row chips show switch-seek / set-zero — NO stale "native", even with a saved method:native', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });   // t710 — boot-readiness gate, own budget (not the 5s actionTimeout cap)
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: 600, z: 500, show: true };
        // the human's config: a SAVED per-axis method:'native' on the linear axes + a rotary A
        s.homing = { philosophy: 'sequential', axes: { z: { enable: true, order: 1, method: 'native' }, x: { enable: true, order: 2, method: 'native' }, a: { enable: true, order: 3, method: 'setzero' } } };
    });
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
    const chips = await page.evaluate(() => [...document.querySelectorAll('#wiz_homing .homing-run-ax')].map((cb) => {
        const lbl = cb.closest('label'); const span = lbl && lbl.querySelector('span');
        return { axis: cb.getAttribute('data-axis'), text: span ? span.textContent.trim() : null };
    }));
    { const _b = await page.locator('#wiz_homing').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_no_stale_native.png', clip: _b }); }   // t710 clip capture
    console.log('HOMING chips: ' + JSON.stringify(chips));
    const z = chips.find((c) => c.axis === 'z'), a = chips.find((c) => c.axis === 'a');
    expect(z && z.text, 'a LINEAR axis (saved native) shows the wizard method: switch-seek').toBe('switch-seek');
    if (a) expect(a.text, 'a ROTARY axis shows set-zero').toBe('set-zero');
    expect(chips.some((c) => /native/i.test(c.text || '')), 'NO stale "native" label anywhere in the run-row chips').toBe(false);
});

test('(3) I/O-step Input: Result-var + Timeout are HIDDEN on a DDCS post, SHOWN on RS274 (dialect-aware); emit unchanged', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 15000 });   // t710 — boot-readiness gate, own budget (not the 5s actionTimeout cap)
    const visOn = async (post) => {
        await page.evaluate(async (p) => { const { __setDialectOverrideForTests } = await import('/wizards/dialects/index.js'); __setDialectOverrideForTests(p); }, post);
        await page.evaluate(() => window.openWiz('user_io_step', 'input'));
        await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
        await page.waitForTimeout(300);
        return page.evaluate(() => {
            const shown = (pm) => { const e = document.querySelector(`#wiz_user_form [data-param="${pm}"]`); return !!(e && e.offsetParent !== null); };
            return { input: shown('inputRef'), edge: shown('mode2'), timeout: shown('timeout'), resultVar: shown('var') };
        });
    };
    const expert = await visOn('ddcs-expert-m350');
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/io_step_input_expert.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    const rs274 = await visOn('rs274ngc');
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/io_step_input_rs274.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    // emit unchanged (visibility only) — the hidden fields still read their values
    const emit = await page.evaluate(async () => {
        const { ioStepStackResolved } = await import('/wizards/ioStepWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { __setDialectOverrideForTests } = await import('/wizards/dialects/index.js');
        const p = { mode: 'input', inputRef: 'raw', waitPin: 4, mode2: 'rise', timeout: 500, var: '#5399' };
        __setDialectOverrideForTests('ddcs-expert-m350'); return emitMapped(ioStepStackResolved(p)).text;
    });
    await page.evaluate(async () => { const { __setDialectOverrideForTests } = await import('/wizards/dialects/index.js'); __setDialectOverrideForTests(null); });
    console.log('EXPERT: ' + JSON.stringify(expert) + ' | RS274: ' + JSON.stringify(rs274));

    expect(expert.input && expert.edge, 'Expert: Input + Edge render').toBe(true);
    expect(expert.timeout, 'Expert: Timeout is HIDDEN (M66 Q — dead on a DDCS poll)').toBe(false);
    expect(expert.resultVar, 'Expert: Result var is HIDDEN (M66 result — dead on a DDCS poll)').toBe(false);
    expect(rs274.timeout && rs274.resultVar, 'RS274: Timeout + Result var are SHOWN (M66 fields)').toBe(true);
    expect(emit, 'the DDCS emit is still the WHILE-poll (visibility change did not touch the emit)').toContain('#[1520+4]');
});

test('(amendment 1) the homing preview draws NO switch-device meshes', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });   // t710 — boot-readiness gate, own budget (not the 5s actionTimeout cap)
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.machine = { x: 600, y: 600, z: 500, show: true }; s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true }; });
    // t1730 — 'homing' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.waitForTimeout(500);
    const dev = await page.evaluate(() => {
        const viz = window.ddcsStudio.wizardManager._activePanel && window.ddcsStudio.wizardManager._activePanel.viz;
        if (!viz) return null;
        return { hasLimitGroup: !!viz._limitGroup, nDevices: viz._limitDevices ? Object.keys(viz._limitDevices).length : 0, getLimitSwitchIsFn: typeof viz.getLimitSwitch === 'function' };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_no_device_meshes.png', clip: _b }); }   // t710 clip capture
    console.log('DEVICE MESHES: ' + JSON.stringify(dev));
    expect(dev && dev.hasLimitGroup, 'NO switch-device mesh group in the homing preview').toBe(false);
    expect(dev && dev.nDevices, 'NO switch device meshes').toBe(0);
});

test('(amendment 2) EVERY homing door routes through the SIMPLE G31 — no M98/O501, for a saved method:native config', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, null, { timeout: 15000 });   // t710 — boot-readiness gate, own budget (not the 5s actionTimeout cap)
    const r = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        // the human's config: a SAVED method:'native' + declared zMaxHome + a +Z machine
        const cfg = { axes: ['z'], config: { z: { enable: true, method: 'native', seekFeed: 800, slowFeed: 100, backoff: 5 } }, machine: { z: 500 }, limits: { zMaxHome: true } };
        const viaStack = emitMapped(homingStack(cfg)).text;            // the WIZARD + the macrosApp Homing Setup + sysstart deploy all call homingStack
        const viaBuilder = emitMapped(builderOf('homing')(cfg)).text;  // the Blocks / op re-open door (opBuilders → homingStack)
        return { viaStack, viaBuilder };
    });
    for (const [door, code] of [['homingStack (wizard/macrosApp/sysstart)', r.viaStack], ['builderOf homing (Blocks/op)', r.viaBuilder]]) {
        expect(code, `${door}: emits G31`).toContain('G31');
        expect(code, `${door}: NO M98 P501`).not.toContain('M98P501');
        expect(code, `${door}: NO O501 debounce/GOTO soup`).not.toMatch(/GOTO\d|N4[0-9]|debounce/i);
        expect(code, `${door}: NO ±10000 magic seek`).not.toContain('10000');
    }
    expect(r.viaBuilder, 'the Blocks/op door == the shared homingStack emit (one source, no duplicate path)').toBe(r.viaStack);
});

test('(amendment 3) a dev BUILD STAMP is visible — window.__ddcsBuild + the .ver chip tooltip (so "is my tree stale" is a fact)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.__ddcsBuild, null, { timeout: 8000 });
    const r = await page.evaluate(() => ({ build: window.__ddcsBuild, tip: (document.querySelector('.ver') || {}).title || '' }));
    console.log('BUILD STAMP: ' + JSON.stringify(r));
    expect(r.build, 'window.__ddcsBuild is the served app.js mtime (iso-ish)').toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}Z$/);
    expect(r.tip, 'the version chip tooltip shows the build stamp').toContain(r.build);
});
