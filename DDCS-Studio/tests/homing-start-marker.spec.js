import { test, expect } from '@playwright/test';

/**
 * t540 (1) DRAGGABLE START MARKER — a sim-only machine-frame Start the operator drags anywhere in the envelope; the
 * homing sim runs FROM it (the tool travels Start → switch). Default MID-ENVELOPE, persists across updates, NEVER emitted.
 * VERIFY: (a) the marker seeds mid-envelope; (b) the played tool STARTS at the Start and ends at the top switch; (c) a
 * drag moves the Start and the next run travels from the NEW Start; (d) the emitted G-code never contains the Start.
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function openHoming(page, z) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate((z) => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: 400, z, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
        s.homing = { axes: { z: { enable: true, order: 1, backoff: 5 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
        s.stock = { show: true, x: 100, y: 100, z: 25, datum: 'nnp' };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    }, z);
    await page.evaluate(() => window.openWiz('homing'));
    await page.waitForSelector('#wiz_homing', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
}

function panel(page) {
    return page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        return p ? { start: p.getStartPos() } : null;
    });
}

test('(a) the Start marker seeds MID-ENVELOPE (machine center)', async ({ page }) => {
    await openHoming(page, 500);
    const p = await panel(page);
    // envelope x=600 y=400 z=500 → center (300, 200, 250)
    expect(p.start, 'a Start is provided (not null)').not.toBeNull();
    expect(Math.round(p.start.x), 'Start X = envelope mid (600/2)').toBe(300);
    expect(Math.round(p.start.y), 'Start Y = envelope mid (400/2)').toBe(200);
    expect(Math.round(p.start.z), 'Start Z = envelope mid (500/2)').toBe(250);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_start_midenvelope.png' });
});

test('(b) the played tool STARTS at the Start and homes UP to the top switch', async ({ page }) => {
    await openHoming(page, 500);
    // capture the engine's INITIAL pos the instant the run begins (seeded from the Start), then let it settle
    const r = await page.evaluate(async () => {
        const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d');
        const run = host.querySelector('.pp-run'); if (run) run.click();
        const p = window.ddcsStudio.wizardManager._activePanel;
        const startZ = p.engine ? +p.engine.pos.z.toFixed(1) : null;   // seeded initial pos = the Start (mid)
        if (p && p.engine) p.engine.simSpeed = 60;
        return { startZ };
    });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine && !p.engine.running; }, null, { timeout: 30000 });
    const end = await page.evaluate(() => +window.ddcsStudio.wizardManager._activePanel.engine.pos.z.toFixed(1));
    // z envelope 0..500, zMaxHome → homes to the TOP (500 − backoff 5 = 495). It STARTED at the mid (250), not 0/500.
    expect(r.startZ, 'the run STARTS at the mid-envelope Start (Z≈250), not part-zero (0)').toBeGreaterThan(200);
    expect(r.startZ, 'the run STARTS at the mid-envelope Start (Z≈250), not the top (500)').toBeLessThan(300);
    expect(end, 'the tool HOMES to the top switch (~495), backed off from 500').toBeGreaterThan(480);
    expect(end, 'the tool ends at the top, not overshooting').toBeLessThanOrEqual(505);
    await page.locator('#wiz_homing').screenshot({ path: 'scratchpad/homing_start_homed.png' });
});

test('(c) dragging the Start makes the NEXT run travel from the NEW Start', async ({ page }) => {
    await openHoming(page, 500);
    // simulate an operator drag of the 3D Start marker to a new envelope spot (pass 0)
    await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        p.onStartDrag({ x: 120, y: 80, z: 60 }, 0);   // the ONE drag seam every view writes
    });
    const after = await page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        const host = document.getElementById('homingVizContainer').parentElement.querySelector('.wiz-viz3d');
        host.querySelector('.pp-run').click();
        return { dragStart: p.getStartPos(), startZ: +p.engine.pos.z.toFixed(1) };
    });
    // the dragged Start persisted AND the run now begins there (Z=60), not the mid default (250)
    expect(Math.round(after.dragStart.z), 'the dragged Start persisted (Z=60)').toBe(60);
    expect(after.startZ, 'the run now STARTS at the dragged Start (Z≈60), not the mid default (250)').toBeLessThan(120);
});

test('(d) the emitted homing G-code NEVER contains the sim-only Start', async ({ page }) => {
    await openHoming(page, 500);
    const code = await page.evaluate(() => document.getElementById('wiz_homing_code').textContent || '');
    // the Start (mid = 300/200/250) must not leak into the macro — it is sim-only
    expect(code).not.toContain('X300');
    expect(code).not.toContain('Y200');
    expect(code).not.toContain('Z250');
    expect(code, 'the macro still emits the G31 seek (unchanged by the Start)').toContain('G31');
});
