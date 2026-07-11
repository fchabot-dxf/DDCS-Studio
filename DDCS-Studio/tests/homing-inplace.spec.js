import { test, expect } from '@playwright/test';

/**
 * HOMING E2-proper (t552) — the built-in Homing slot opens the user_homing_data TWIN IN-PLACE (opensAs), with the run-form
 * (per-axis ticks) + the code preview + the machine-frame 3D behaving EXACTLY as the legacy panel: FORCED envelope box
 * (regardless of settings.machine.show) + the draggable machine-frame START marker + the preview PLAYS THE REAL EMIT + the
 * tool in the machine frame. VERIFY the in-place open, the forced envelope with show OFF, and the played tool at the top.
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function openHomingInPlace(page, z) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });   // t712 — boot gate, own budget
    await page.evaluate((z) => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: 400, z, show: false, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };   // show OFF — the box must still force
        s.homing = { axes: { z: { enable: true, order: 1, backoff: 5 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
        s.stock = { show: true, x: 100, y: 100, z: 25, datum: 'nnp' };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    }, z);
    // the built-in Homing slot opensAs the twin → openWiz('homing') routes to user_homing_data (or open it directly)
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
}

test('the Homing slot opensAs the twin: opens in-place (plain title, twin hidden), the run ticks + a G31 code preview', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram, null, { timeout: 15000 });   // t712 — boot gate, own budget
    const wired = await page.evaluate(async () => {
        const WL = await import('/blocks/wizardLibrary.js');
        const { listUserOps } = await import('/blocks/userOps.js');
        const title = WL.builtinLabelForTwin ? WL.builtinLabelForTwin('user_homing_data') : null;   // the plain built-in title → proves opensAs is wired
        const seeded = listUserOps().some((d) => d.opType === 'user_homing_data');
        return { title, seeded };
    });
    // the wiring: homing opensAs the twin → the twin carries the plain 'Homing' title; it's seeded at boot
    expect(wired.title, 'the Homing slot opensAs the twin (plain built-in title)').toBe('Homing');
    expect(wired.seeded, 'the twin is seeded at boot (seedDefaultPortedUserOps)').toBe(true);

    await openHomingInPlace(page, 500);
    const form = await page.evaluate(() => {
        const ticks = [...document.querySelectorAll('#wiz_user_form [data-param^="run_"]')].map((e) => e.getAttribute('data-param'));
        const code = document.getElementById('wiz_user_code') ? document.getElementById('wiz_user_code').textContent : '';
        return { ticks, hasG31: /G31/.test(code), isProxy: /SIMULATION PROXY/.test(code) };
    });
    expect(form.ticks.length, 'the run-form shows per-axis run ticks').toBeGreaterThanOrEqual(3);
    expect(form.hasG31, 'the code preview shows the REAL G31 emit').toBe(true);
    expect(form.isProxy, 'NOT a proxy — the real emit').toBe(false);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_inplace_form.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
});

for (const z of [500, -120]) {
    test(`z=${z}: the in-place preview FORCES the envelope (show OFF) + plays the REAL emit to the top-backoff (machine frame)`, async ({ page }) => {
        await openHomingInPlace(page, z);
        // the envelope box is FORCED even though settings.machine.show is OFF (opSimContext forceMachine via the twin's sim{machine})
        const forced = await page.evaluate(() => {
            const p = window.ddcsStudio.wizardManager._activePanel;
            return { show: window.ddcsGetSettings().machine.show, box: !!(p && p.viz && p.viz.machineBox), toolMachine: !!(p && p.viz && p.viz._toolMachineFrame) };
        });
        expect(forced.show, 'settings.machine.show is OFF').toBe(false);
        expect(forced.box, 'the envelope box is FORCED on (machine-frame twin)').toBe(true);
        expect(forced.toolMachine, 'the tool renders in the machine frame (toolMachine intent)').toBe(true);

        // play the REAL emit → the tool homes to the top switch (~z-5 for +500; ~-5 for -120), machine frame
        await page.evaluate(() => { const host = document.getElementById('userViz3dContainer').parentElement.querySelector('.wiz-viz3d'); const run = host.querySelector('.pp-run'); if (run) run.click(); const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 60; });
        await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine && !p.engine.running; }, null, { timeout: 25000 });
        const endZ = await page.evaluate(() => +window.ddcsStudio.wizardManager._activePanel.engine.pos.z.toFixed(1));
        const topBackoff = z > 0 ? z - 5 : -5;
        expect(Math.abs(endZ - topBackoff) < 2, `the played tool homes to the top-backoff (~${topBackoff}), got ${endZ}`).toBe(true);
        if (z === 500) { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_inplace_running.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    });
}
