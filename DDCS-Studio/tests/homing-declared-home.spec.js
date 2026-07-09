import { test, expect } from '@playwright/test';

/**
 * HOMING increment 2 (t504) — homing READS the DECLARED home switch (settings.limits.<edge>Home), NOT the machine
 * travel-SIGN. The sign inference (axisSpan.homeSide → machine-0) WAS the positive-Z plunge: a +Z envelope makes
 * machine-0 the BOTTOM. Now the home end = the declared edge (seeded Z→z_max/top), so Z homes UP to the TOP whether
 * machine.z is + or − (SIGN-AGNOSTIC). VERIFY the seek TARGET (axisHomeMotion), the sim proxy, the emitted G31
 * direction, and the REAL wizard at BOTH signs. DECLARATION-read only — the emit STRUCTURE is untouched (increment 3).
 */
test.use({ viewport: { width: 1300, height: 950 } });

// ── DETERMINISTIC: the home TARGET + emit direction are the declared TOP (z_max = hi) for BOTH signs. ──
test('axisHomeMotion + the emitted G31 target the DECLARED home edge (z_max = TOP), sign-agnostic', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { axisHomeMotion, declaredHomeEdgeSide } = await import('/engine/limitSwitches.js');
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const zMax = { zMaxHome: true }, zMin = { zMinHome: true };
        const seekOf = (travel, limits) => axisHomeMotion(travel, { axis: 'z', limits, backoff: 5 }).seek;
        const g31Dist = (z, limits) => (emitMapped(homingStack({ axes: ['z'], config: { z: { enable: true } }, machine: { z }, limits })).text.match(/G31 Z(-?[\d.]+)/) || [])[1];   // t536 — the simple shape's first (fast) G31 Z seek distance (span-sized, signed toward the home end)
        return {
            side: { neg: declaredHomeEdgeSide('z', zMax), noDecl: declaredHomeEdgeSide('z', {}) },
            seek: { negMax: seekOf(-120, zMax), posMax: seekOf(500, zMax), posMin: seekOf(500, zMin), posNoDecl: seekOf(500, {}) },
            g31: { neg: g31Dist(-120, zMax), pos: g31Dist(500, zMax) },
        };
    });
    // declaredHomeEdgeSide reads the flag (max) and returns null when nothing is declared
    expect(r.side.neg, 'zMaxHome → the max edge is home').toBe('max');
    expect(r.side.noDecl, 'no declared home → null (caller falls back to the sign)').toBe(null);
    // the home TARGET is the DECLARED edge (z_max = hi = the TOP), SIGN-AGNOSTIC:
    expect(r.seek.negMax, 'Z=-120, zMaxHome → seek the TOP (hi=0)').toBe(0);
    expect(r.seek.posMax, 'Z=+500, zMaxHome → seek the TOP (hi=500), NOT machine-0/bottom (the plunge)').toBe(500);
    // it READS the flag, not the sign: zMinHome on the same +500 envelope → the BOTTOM (lo=0)
    expect(r.seek.posMin, 'Z=+500, zMinHome → seek the bottom (lo=0) — proves it reads the flag').toBe(0);
    // no declaration → the sign-derived machine-0 fallback (no regression)
    expect(r.seek.posNoDecl, 'Z=+500, no declared home → sign-derived machine-0 (0)').toBe(0);
    // t542 — the hand-made simProxy is DELETED (the preview plays the real emit); the declared-edge target lives in
    // axisHomeMotion (asserted above) + the emitted G31 direction (below), the ONE source. No proxy assertion.
    // the emitted G31 seeks UP (a POSITIVE, span-sized distance) toward z_max for BOTH signs (t536 simple shape)
    expect(Number(r.g31.neg), 'G31 Z=-120 seeks UP (positive) toward z_max').toBeGreaterThan(0);
    expect(Number(r.g31.pos), 'G31 Z=+500 seeks UP (positive) toward z_max, NOT down toward machine-0').toBeGreaterThan(0);
});

// ── REAL APP, BOTH SIGNS: the sim tool homes UP to the declared top switch and settles there (no plunge). ──
async function homeSettle(page, z, shot) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate((z) => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: -600, z, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.homing = { axes: { z: { enable: true, order: 1, backoff: 5 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };   // the seeded declared home (Z = z_max/top)
        s.stock = { show: true, x: 100, y: 100, z: 25, datum: 'nnp' };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    }, z);
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
    await page.evaluate(() => {
        const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d');
        const run = host.querySelector('.pp-run'); if (run) run.click();
        const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 60;   // speed the long +500 rapid so it settles fast
    });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine && !p.engine.running; }, null, { timeout: 30000 });
    const r = await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        let w = null; try { p.viz._animTool.updateWorldMatrix(true, false); w = +p.viz._animTool.getWorldPosition(new (p.viz.THREE.Vector3)()).z.toFixed(1); } catch (e) {}
        return { engineZ: +p.engine.pos.z.toFixed(1), worldZ: w };
    });
    if (shot) await page.locator('#wiz_homing').screenshot({ path: shot });
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
