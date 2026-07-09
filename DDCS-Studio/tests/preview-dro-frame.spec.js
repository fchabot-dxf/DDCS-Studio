import { test, expect } from '@playwright/test';

/**
 * PREVIEW-PARITY E2d (t588) — the DRO reads its WCS offset from THE ONE frame source (sceneFrame.wcsOffsetAt); no local
 * table lookup in createPreviewPanel. Mach = Work + wcsOffsetAt(machine, activeIdx). The active index still honours a
 * program-driven G54-G59 override for the SIM (simActiveWcs), so the override WINS over the settings-active WCS.
 * Verified: (unit) wcsOffsetAt honours the index + the workOrigin fallback; (real app) the main-editor DRO's Mach−Work ==
 * the settings-active WCS with no override, and == the OVERRIDDEN WCS after a mid-run G55 line.
 */
const BASE = process.env.STUDIO_URL || 'http://localhost:3211';
const STEP = '#viz3d-panel-host .pp-step';

test('sceneFrame.wcsOffsetAt honours the index + the workOrigin fallback (the one table read)', async ({ page }) => {
    await page.goto(BASE);
    const r = await page.evaluate(async () => {
        const { wcsOffsetAt } = await import('/viz/sceneFrame.js');
        const m = { workOrigin: { x: 5, y: 6, z: 0 }, wcs: { active: 1, table: [{ x: 10, y: 20, z: 0 }, { x: 100, y: 200, z: 0 }] } };
        return {
            g54: wcsOffsetAt(m, 1), g55: wcsOffsetAt(m, 2),
            missing: wcsOffsetAt({ workOrigin: { x: 5, y: 6, z: 0 }, wcs: { active: 1, table: [] } }, 1),
            noMachine: wcsOffsetAt(null, 1),
        };
    });
    expect(r.g54, 'idx 1 → the G54 row').toEqual({ x: 10, y: 20, z: 0 });
    expect(r.g55, 'idx 2 → the G55 row (an override index resolves DIFFERENTLY)').toEqual({ x: 100, y: 200, z: 0 });
    expect(r.missing, 'no table row → the workOrigin fallback').toEqual({ x: 5, y: 6, z: 0 });
    expect(r.noMachine, 'no machine → {0,0,0}').toEqual({ x: 0, y: 0, z: 0 });
});

// Drive the REAL main-editor sim (the shared preview panel) — Step deterministically, read the DRO Work/Mach.
async function droAfter(page, program) {
    await page.goto(BASE);
    await page.waitForFunction(() => !!window.ddcsGetSettings && typeof window.setGcodeView === 'function');
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        // G54 (settings active) = {10,20}; G55 = {100,200} — distinct so the override is visible.
        s.machine = { x: 600, y: 400, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [{ x: 10, y: 20, z: 0 }, { x: 100, y: 200, z: 0 }] } };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    });
    await page.locator('#editor').fill(program);
    await page.evaluate(() => window.setGcodeView('3d'));
    await page.waitForSelector(STEP, { state: 'attached', timeout: 8000 });
    // step through every line (a move completes in one step)
    for (let i = 0; i < program.split('\n').length; i++) { await page.locator(STEP).click(); await page.waitForTimeout(60); }
    return page.evaluate(() => {
        const row = document.querySelector('#viz3d-panel-host .pp-dro-tbl tr[data-ax="x"]');
        const rowY = document.querySelector('#viz3d-panel-host .pp-dro-tbl tr[data-ax="y"]');
        const num = (el, c) => el ? parseFloat(el.querySelector(c).textContent) : NaN;
        return { wx: num(row, '.pp-dro-w'), mx: num(row, '.pp-dro-m'), wy: num(rowY, '.pp-dro-w'), my: num(rowY, '.pp-dro-m') };
    });
}

test('DRO: Mach − Work == the SETTINGS-active WCS with no program override (G54)', async ({ page }) => {
    const d = await droAfter(page, 'G90\nG0 X30 Y40\nM30');
    expect(Math.abs(d.wx - 30), 'Work X = the program X').toBeLessThan(0.5);
    expect(Math.abs((d.mx - d.wx) - 10), 'Mach−Work X == G54.x (settings active = 10)').toBeLessThan(0.5);
    expect(Math.abs((d.my - d.wy) - 20), 'Mach−Work Y == G54.y (20)').toBeLessThan(0.5);
});

test('DRO: a mid-run G55 line OVERRIDES the WCS — Mach − Work == G55, not the settings-active G54 (simActiveWcs wins)', async ({ page }) => {
    const d = await droAfter(page, 'G90\nG55\nG0 X30 Y40\nM30');
    expect(Math.abs(d.wx - 30), 'Work X = the program X (unshifted)').toBeLessThan(0.5);
    expect(Math.abs((d.mx - d.wx) - 100), 'Mach−Work X == G55.x (100) — the override won over G54 (10)').toBeLessThan(0.5);
    expect(Math.abs((d.my - d.wy) - 200), 'Mach−Work Y == G55.y (200)').toBeLessThan(0.5);
});
