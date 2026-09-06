import { test, expect } from '@playwright/test';

/**
 * HOMING increment 2 (t504) — split from homing-declared-home.spec.js at the t2695 tier migration (batch 5). The
 * file's first ("deterministic") test moved to tests/node/homing-declared-home.test.mjs (pure); these two stayed
 * because they drive the real wizard, play a real Three.js simulation, and screenshot.
 */
test.use({ viewport: { width: 1300, height: 950 } });

// ── REAL APP, BOTH SIGNS: the sim tool homes UP to the declared top switch and settles there (no plunge). ──
async function homeSettle(page, z, shot) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });   // t710 — boot-readiness gate, own budget (not the 5s actionTimeout cap)
    await page.evaluate((z) => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: -600, z, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.homing = { axes: { z: { enable: true, order: 1, backoff: 5 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };   // the seeded declared home (Z = z_max/top)
        s.stock = { show: true, x: 100, y: 100, z: 25, datum: 'nnp' };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    }, z);
    // t1730 — 'homing' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
    await page.evaluate(() => {
        const host = document.querySelector('.wiz-viz3d');
        const run = host.querySelector('.pp-run'); if (run) run.click();
        const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 60;   // speed the long +500 rapid so it settles fast
    });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine && !p.engine.running; }, null, { timeout: 30000 });
    const r = await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        let w = null; try { p.viz._animTool.updateWorldMatrix(true, false); w = +p.viz._animTool.getWorldPosition(new (p.viz.THREE.Vector3)()).z.toFixed(1); } catch (e) {}
        return { engineZ: +p.engine.pos.z.toFixed(1), worldZ: w };
    });
    // t710 — clip capture (page.screenshot forces a composite) dodges locator.screenshot's rAF-starved "wait for stable" on the idle 3D viz
    if (shot) { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: shot, clip: _b }); }
    return r;
}

test('REAL APP: machine.z=-120, declared zMaxHome → the tool homes to the TOP (~-5), not the bottom', async ({ page }) => {
    const r = await homeSettle(page, -120, 'scratchpad/homing_declared_z_neg120.png');
    // Z homes to the top (hi=0) then backs off 5 → rests near -5, FAR from the -120 bottom
    expect(r.engineZ > -8 && r.engineZ <= 0, `engine Z settles at the top-backed-off (${r.engineZ}), not the -120 bottom`).toBe(true);
    expect(r.worldZ != null && r.worldZ > -8, `the rendered tool rests near the top (worldZ=${r.worldZ}), not plunged`).toBe(true);
});

test('REAL APP: machine.z=+500, declared zMaxHome → the tool homes UP to the TOP (~495), NOT machine-0/bottom (the plunge)', async ({ page }) => {
    const r = await homeSettle(page, 500, 'scratchpad/homing_declared_z_pos500.png');
    // THE FIX: a +Z envelope homes to the DECLARED TOP (hi=500) backed off → ~495. The OLD sign-guess drove to machine-0=0 (the plunge).
    expect(r.engineZ > 480, `engine Z homes UP to the declared top (${r.engineZ} ≈ 495), NOT machine-0/bottom (0) — the plunge is gone`).toBe(true);
    expect(r.worldZ != null && r.worldZ > 400, `the rendered tool rises to the top (worldZ=${r.worldZ}), not plunged to the bottom`).toBe(true);
});
