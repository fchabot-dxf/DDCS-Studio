import { test, expect } from '@playwright/test';

/**
 * HOMING WIZARD OUTPUT = explicit G31 seek (t499) — split from homing-g31-output.spec.js at the t2695 tier
 * migration (batch 5). The file's 1st and 4th tests moved to tests/node/homing-g31-output.test.mjs (pure); these
 * two stayed — both drive the real wizard + real DOM, and the second is the rAF/`viz._animTool` world-matrix
 * frame-sampling test the dispatch itself named.
 */
test.use({ viewport: { width: 1300, height: 950 } });

// Drive the ACTUAL wizard with a STOCK shown: the code panel shows G31 (not M98) AND the rendered tool seeks to the
// switch/top (worldZ ~-5, where the G31 goes), NOT plunging. Assert both the EMITTED CODE and the RENDERED tool.
async function driveHomingWizard(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: -600, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        // method OMITTED per-axis → the wizard's default = seek (G31). This is the human's out-of-the-box scenario.
        s.homing = { axes: { z: { enable: true, order: 1, backoff: 5 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.stock = { show: true, x: 100, y: 100, z: 25, datum: 'nnp' };   // a workpiece IS shown (the human's scenario)
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    });
    // t1730 — 'homing' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
}

test('REAL APP: the homing wizard code panel shows G31 (not M98), params visible', async ({ page }) => {
    await driveHomingWizard(page);
    const code = await page.evaluate(() => document.getElementById('wiz_user_code').textContent || '');
    expect(code, 'the emitted homing code shown to the user is G31').toContain('G31');
    expect(code, 'the emitted homing code is NOT M98 P501 (params no longer hidden in the O501 macro)').not.toContain('M98P501');
    expect(code, 'the seek port param (a limit-port register) is visible in the code panel').toMatch(/P#\d+/);
});

test('REAL APP: with a STOCK SHOWN, the G31 homing preview tool seeks to the switch/top (~-5), NOT plunging', async ({ page }) => {
    await driveHomingWizard(page);
    // t542 — the preview plays the REAL emit (slow F100 re-touches); simSpeed it so the trajectory lands in the sampling window.
    await page.evaluate(() => { const host = document.querySelector('.wiz-viz3d'); const run = host.querySelector('.pp-run'); if (run) run.click(); const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 20; });
    const out = [];
    for (let i = 0; i < 22; i++) {
        out.push(await page.evaluate(() => {
            const p = window.ddcsStudio.wizardManager._activePanel;
            const ez = p && p.engine && p.engine.pos ? +p.engine.pos.z.toFixed(1) : null;
            let w = null; try { if (p && p.viz && p.viz._animTool) { p.viz._animTool.updateWorldMatrix(true, false); w = +p.viz._animTool.getWorldPosition(new (p.viz.THREE.Vector3)()).z.toFixed(1); } } catch (e) { /* */ }
            return { ez, w };
        }));
        await page.waitForTimeout(110);
    }
    const w = out.map((s) => s.w).filter((v) => v != null);
    const ez = out.map((s) => s.ez).filter((v) => v != null);
    const wMin = Math.min(...w), wMax = Math.max(...w), ezMin = Math.min(...ez);
    expect(wMax >= -6, `the rendered tool reaches the switch/top (worldZ max=${wMax}), NOT the -100 bottom`).toBe(true);
    // t540 — the tool now STARTS at the mid-envelope draggable Start and travels UP to the switch, so it legitimately
    // occupies mid-Z (was pinned near the top). The t497 "no plunge" property is that the RENDERED tool TRACKS engine.pos.z
    // (machine frame): assert wMin matches the engine's min, so a stock-floor plunge (w≈-100 while engine≈-60..-5) fails.
    expect(Math.abs(wMin - ezMin) < 3, `the rendered tool TRACKS engine.pos.z (worldZ min=${wMin}, engine min=${ezMin}) — no stock-floor plunge`).toBe(true);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_g31_tool_at_switch.png', clip: _b }); }   // t710 clip capture (rAF-starvation dodge)
});
