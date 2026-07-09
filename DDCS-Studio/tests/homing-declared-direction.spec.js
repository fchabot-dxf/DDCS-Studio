import { test, expect } from '@playwright/test';

/**
 * HOMING — the DECLARED ENVELOPE SIGN is the SINGLE source of the home direction (t491, the human's principle:
 * "the home direction can't be hand-rolled or hardcoded — it is DECLARED by the user" = the signed machine.<axis>
 * travel). The Z=-120 PLUNGE (live-reported after V10.97) was a per-axis homing.z.dir='-' DIVERGING from the declared
 * sign — it seeked the far/bottom end (-120) instead of the declared home (machine-0/top). FIX: axisHomeMotion derives
 * the home end from the envelope sign (machine-0) so a stale dir can NO LONGER diverge it. Reproduce → fix → confirm:
 * machine.z=-120 homes Z to the TOP (0) REGARDLESS of any dir; a +120 axis homes to its declared 0 end; byte-identical.
 */

test('the DECLARED envelope sign wins: machine.z=-120 homes Z to the TOP (0), NOT -120, regardless of any homing.z.dir', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        const { axisHomeMotion } = await import('/engine/limitSwitches.js');
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        // t542 — the hand-made simProxy is DELETED; the declared home TARGET is axisHomeMotion (the ONE source the emit +
        // the M98 engine handler both read), which takes NO dir → a stale per-axis dir simply cannot enter it.
        const seek = axisHomeMotion(-120, { axis: 'z', limits: {}, backoff: 5 }).seek;
        // the M98 engine handler with a STALE dir (the human's divergence): the final Z must be -5 (the TOP backed off),
        // NOT -115 (backed off from the far/bottom -120 end = the plunge).
        const engineLastZ = (dir) => {
            const s = window.ddcsGetSettings();
            s.machine = { x: 300, y: 200, z: -120 };
            s.homing = { axes: { z: { method: 'native', dir, backoff: 5 } } };
            s.limits = {};
            const eng = new GcodeExecutionEngine({ autoAnswer: true });
            const tr = eng.trace(['G90', 'G0 X0 Y0 Z0', 'M98P501X2', 'M30'].join('\n'));
            return tr.segments[tr.segments.length - 1].z2;
        };
        return {
            seek,
            engAuto: engineLastZ(''), engMinus: engineLastZ('-'), engPlus: engineLastZ('+'),
        };
    });
    // the declared home TARGET is the TOP (0) — and axisHomeMotion has no dir, so a stale dir CANNOT diverge it
    expect(r.seek, 'the declared home target = the TOP (Z0), NOT the -120 plunge; no dir input can change it').toBe(0);
    // the native M98 handler homes to the TOP → backed off to -5 (NOT -115 = backed off from the far -120 end)
    expect(r.engAuto, 'native M98: homes to the top, back-off -5').toBe(-5);
    expect(r.engMinus, 'native M98 with a STALE dir=-: STILL the top (-5), NOT the -120 plunge (-115)').toBe(-5);
    expect(r.engPlus, 'native M98 with dir=+: the top (-5)').toBe(-5);
});

test('a +120 axis homes to its declared 0 end (the envelope sign), regardless of dir', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        // t542 — proxy deleted; the declared home target = axisHomeMotion (no dir input). +120 envelope → home at the 0 end.
        const { axisHomeMotion } = await import('/engine/limitSwitches.js');
        return { seek: axisHomeMotion(120, { axis: 'z', limits: {}, backoff: 5 }).seek };
    });
    expect(r.seek, '+120 declared → home at the 0 end (machine-0); axisHomeMotion has no dir to diverge it').toBe(0);
});

test('t536 — a LINEAR axis with a SAVED method:native emits the SIMPLE G31 (the wizard IGNORES the saved method), dir-independent', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const emit = (dir) => emitMapped(homingStack({ axes: ['z'], config: { z: { method: 'native', dir } }, machine: { z: -120 } })).text;
        return { auto: emit(''), minus: emit('-') };
    });
    // the WIZARD is G31-only for linear axes (the human 4×): a SAVED method:'native' is IGNORED → G31, not M98 P501.
    expect(r.auto, 'a saved native method on Z → the wizard STILL emits G31 (ignores it)').toContain('G31');
    expect(r.auto, 'the wizard does NOT emit the native M98 P501 for a linear axis').not.toContain('M98P501');
    // and dir is dropped → the emit is byte-identical regardless of the stale saved dir
    expect(r.minus, 'the wizard homing emit is byte-identical regardless of the (ignored) dir').toBe(r.auto);
});

test.use({ viewport: { width: 1300, height: 950 } });
test('DRIVE THE APP: with a STALE dir=-, machine.z=-120 still homes Z UP to the top (not plunged) — screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.preview = s.preview || {}; s.preview.autoLoop = false;
        s.machine = { x: 300, y: 200, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        // the human's config: machine.z=-120 (home at the TOP) BUT a STALE per-axis dir='-' that used to plunge Z to -120
        s.homing = { axes: { z: { method: 'native', dir: '-', backoff: 5, enable: true, order: 1 } } };
    });
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());
    // t542 — PLAY the REAL emitted homing code (the preview no longer uses a proxy). simSpeed up the slow re-touch so it
    // settles fast, then assert the PLAYED engine homed Z to the TOP (-5, backed off), NOT the -120 plunge (-115).
    await page.evaluate(() => { const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d'); const run = host.querySelector('.pp-run'); if (run) run.click(); const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 60; });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine && !p.engine.running; }, null, { timeout: 20000 });
    const endZ = await page.evaluate(() => +window.ddcsStudio.wizardManager._activePanel.engine.pos.z.toFixed(1));
    expect(endZ, 'even with a stale dir=-, the PLAYED real emit homes Z to the TOP (~-5), not the -120 plunge (-115)').toBeGreaterThan(-8);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_declared_dir_top.png' });
});
