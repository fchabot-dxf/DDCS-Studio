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
        const { homingSimProxy } = await import('/wizards/homingWizard.js');
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        const zSeek = (dir) => {
            const t = homingSimProxy({ axes: ['z'], config: { z: { method: 'native', dir } }, machine: { z: -120 } });
            const m = t.match(/G53 G0 Z(-?[\d.]+)/); return m ? parseFloat(m[1]) : null;
        };
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
            simAuto: zSeek(''), simMinus: zSeek('-'), simPlus: zSeek('+'),
            engAuto: engineLastZ(''), engMinus: engineLastZ('-'), engPlus: engineLastZ('+'),
        };
    });
    // the sim seeks the TOP (0) for EVERY dir — a stale dir='-' can no longer plunge to -120
    expect(r.simAuto, 'Auto → the declared home = the TOP (Z0)').toBe(0);
    expect(r.simMinus, 'a STALE dir=- can NO LONGER diverge → still the TOP (Z0), NOT the -120 plunge').toBe(0);
    expect(r.simPlus, 'dir=+ → still the declared TOP (Z0)').toBe(0);
    // the native M98 handler homes to the TOP → backed off to -5 (NOT -115 = backed off from the far -120 end)
    expect(r.engAuto, 'native M98: homes to the top, back-off -5').toBe(-5);
    expect(r.engMinus, 'native M98 with a STALE dir=-: STILL the top (-5), NOT the -120 plunge (-115)').toBe(-5);
    expect(r.engPlus, 'native M98 with dir=+: the top (-5)').toBe(-5);
});

test('a +120 axis homes to its declared 0 end (the envelope sign), regardless of dir', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        const { homingSimProxy } = await import('/wizards/homingWizard.js');
        const zSeek = (dir) => { const t = homingSimProxy({ axes: ['z'], config: { z: { method: 'native', dir } }, machine: { z: 120 } }); const m = t.match(/G53 G0 Z(-?[\d.]+)/); return m ? parseFloat(m[1]) : null; };
        return { auto: zSeek(''), minus: zSeek('-'), plus: zSeek('+') };
    });
    expect(r.auto, '+120 declared → home at the 0 end (machine-0)').toBe(0);
    expect(r.minus, 'a dir override cannot diverge it → still 0').toBe(0);
    expect(r.plus, 'still the declared 0 end').toBe(0);
});

test('emit BYTE-IDENTICAL — the home-end reconciliation is sim-only (native M98 P501 unchanged by dir)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const emit = (dir) => emitMapped(homingStack({ axes: ['z'], config: { z: { method: 'native', dir } }, machine: { z: -120 } })).text;
        return { auto: emit(''), minus: emit('-') };
    });
    expect(r.minus, 'the native homing emit is byte-identical regardless of dir (sim-only fix)').toBe(r.auto);
    expect(r.auto.includes('M98'), 'still emits the M98 P501 home call').toBe(true);
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
    // run the homing sim
    await page.evaluate(() => { const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d'); const run = host.querySelector('.pp-run'); if (run) run.click(); });
    await page.waitForTimeout(2000);
    // the sim seeks Z to the TOP (0) even with the stale dir=- (the fix); the tool rests backed off just below the top
    const seek = await page.evaluate(async () => { const { homingSimProxy } = await import('/wizards/homingWizard.js'); const t = homingSimProxy({ axes: ['z'], config: { z: { method: 'native', dir: '-' } }, machine: { z: -120 } }); const m = t.match(/G53 G0 Z(-?[\d.]+)/); return m ? parseFloat(m[1]) : null; });
    expect(seek, 'even with a stale dir=-, the sim seeks Z to the TOP (0), not the -120 plunge').toBe(0);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_declared_dir_top.png' });
});
