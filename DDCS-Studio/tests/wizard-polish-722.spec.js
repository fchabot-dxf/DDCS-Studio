import { test, expect } from '@playwright/test';

/**
 * t722 P2a — WIZARD POLISH (form/preview only, NO emit change). (1) per-KIND field visibility via when-guards; (4) the
 * sim/carve/label use the op's TYPED toolDia (not the honest-6 fallback) + honest wording. Emit byte-identity is covered
 * by the as-data goldens (a when hides the FORM row; the field still reads + emits its default → unchanged).
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function open(page, op) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; s.preview.carve = true; });
    await page.evaluate((o) => window.openWiz(o), op);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
}
const vis = (page, param) => page.evaluate((p) => { const f = document.querySelector(`#wiz_user_form [data-param="${p}"]`); if (!f) return 'absent'; const row = f.closest('[data-when],[data-when-all],label,.uop-row,.wiz-row,div'); return (row && row.offsetParent !== null) ? 'shown' : 'hidden'; }, param);
async function setP(page, k, v) { await page.evaluate(([k2, v2]) => { const f = document.querySelector(`#wiz_user_form [data-param="${k2}"]`); if (f) { f.value = v2; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } }, [k, v]); await page.waitForTimeout(300); }

// (1) drill per-PATTERN visibility — the fields FOLLOW the kind live.
test('(1) drill: per-pattern field visibility follows the pattern live', async ({ page }) => {
    await open(page, 'user_drill_data');
    await setP(page, 'pattern', 'grid');
    expect(await vis(page, 'cols'), 'grid → cols shown').toBe('shown');
    expect(await vis(page, 'dia'), 'grid → dia hidden').toBe('hidden');
    await setP(page, 'pattern', 'circle');
    expect(await vis(page, 'dia'), 'circle → dia shown').toBe('shown');
    expect(await vis(page, 'startAngle'), 'circle → startAngle shown').toBe('shown');
    expect(await vis(page, 'cols'), 'circle → cols hidden').toBe('hidden');
    await setP(page, 'pattern', 'line');
    expect(await vis(page, 'spacing'), 'line → spacing shown').toBe('shown');
    expect(await vis(page, 'w'), 'line → w hidden').toBe('hidden');
    await setP(page, 'pattern', 'rect');
    expect(await vis(page, 'w'), 'rect → w shown').toBe('shown');
    expect(await vis(page, 'nx'), 'rect → nx shown').toBe('shown');
    expect(await vis(page, 'spacing'), 'rect → spacing hidden').toBe('hidden');
});

// (1) contour per-SHAPE visibility — W/H for rect+ellipse, Ø for circle+polygon, Sides polygon-only.
test('(1) contour: per-shape field visibility (W/H rect+ellipse, Ø circle+polygon, sides polygon-only)', async ({ page }) => {
    await open(page, 'user_contour_data');
    await setP(page, 'shape', 'rect');
    expect(await vis(page, 'w'), 'rect → W shown').toBe('shown');
    expect(await vis(page, 'dia'), 'rect → Ø hidden').toBe('hidden');
    await setP(page, 'shape', 'ellipse');
    expect(await vis(page, 'w'), 'ellipse → W shown').toBe('shown');
    await setP(page, 'shape', 'circle');
    expect(await vis(page, 'dia'), 'circle → Ø shown').toBe('shown');
    expect(await vis(page, 'w'), 'circle → W hidden').toBe('hidden');
    expect(await vis(page, 'sides'), 'circle → sides hidden').toBe('hidden');
    await setP(page, 'shape', 'polygon');
    expect(await vis(page, 'dia'), 'polygon → Ø shown').toBe('shown');
    expect(await vis(page, 'sides'), 'polygon → sides shown').toBe('shown');
});

// (4) the material-view note uses the op's TYPED toolDia (proving simTool → carve radius follow it) + honest wording.
test('(4) the carve note discloses the op TYPED toolDia + honest wording (no cognition verbs)', async ({ page }) => {
    await open(page, 'user_contour_data');
    await setP(page, 'toolDia', 12);
    await page.waitForTimeout(500);
    const txt = await page.evaluate(() => { const n = document.querySelector('#wiz_user .pp-carve-note'); return n ? n.textContent : ''; });
    expect(txt, 'the note shows the TYPED Ø12 (simTool used it → carve radius = 6)').toContain('Ø12');
    expect(txt, 'honest: op value, no tool picked').toContain('op value');
    expect(txt.toLowerCase(), 'no cognition verb (assuming/guessing)').not.toMatch(/assum|guess/);
});
