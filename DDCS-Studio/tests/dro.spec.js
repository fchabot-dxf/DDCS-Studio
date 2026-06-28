import { test, expect } from '@playwright/test';

/**
 * DRO — a dual numeric readout mirroring the DDCS controller: Work (the tool's program position) + Mach, rows X/Y/Z,
 * under the active-WCS label. Work = onPositionChange; Mach = Work + the ACTIVE WCS offset, read LIVE through one
 * accessor (activeWcsOffset) so the future per-G54-G59 table drops in with no DRO change. The Work column flashes + the
 * label updates on a WCS/probe event. Drives the REAL Simulate (the shared preview engine). No engine change.
 */
const BASE = process.env.STUDIO_URL || 'http://localhost:3211';
const RUN = '#viz3d-panel-host .pp-run';
const STATUS = '#viz3d-panel-host .pp-status';

async function setup(page, program) {
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ioPanel && typeof window.ddcsGetSettings === 'function' && typeof window.setGcodeView === 'function');
  await page.locator('#editor').fill(program);
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(RUN, { state: 'attached', timeout: 8000 });
}
const row = (ax) => {
  const tr = document.querySelector(`#viz3d-panel-host .pp-dro tr[data-ax="${ax}"]`);
  return { w: +tr.children[1].textContent, m: +tr.children[2].textContent };
};

test('DRO structure: Work + Mach columns, X/Y/Z rows, active-WCS label', async ({ page }) => {
  await setup(page, 'G54\nG0 X10 Y20\nM30');
  const s = await page.evaluate(() => {
    const dro = document.querySelector('#viz3d-panel-host .pp-dro');
    return {
      heads: [...dro.querySelectorAll('thead th')].map((t) => t.textContent.trim()),
      axes: [...dro.querySelectorAll('tbody tr')].map((r) => r.getAttribute('data-ax')),
      wcs: dro.querySelector('.pp-dro-wcs').textContent.trim(),
    };
  });
  expect(s.heads).toEqual(['', 'Work', 'Mach']);
  expect(s.axes).toEqual(['x', 'y', 'z']);
  expect(s.wcs).toBe('G54');
});

test('DRO live: Mach = Work + the active-WCS TABLE offset (reads the table, not the stale workOrigin cache)', async ({ page }) => {
  await setup(page, 'G54\nG0 X30 Y15\nG1 Z-4 F300\nM30');
  // the FIX: the G54 offset lives in machine.wcs.table[0]. workOrigin is the STALE cache the bug read — if the DRO read
  // THAT here ({0,0,0}), Mach would equal Work (the reported symptom). Reading the table makes Mach = Work + G54.
  await page.evaluate(() => {
    const m = window.ddcsGetSettings().machine;
    m.wcs = { active: 1, table: [{ x: 100, y: 200, z: 50 }, { x: -30, y: -40, z: -5 }] };
    m.workOrigin = { x: 0, y: 0, z: 0 };
  });
  await page.locator(RUN).click();
  await expect(page.locator(STATUS)).toContainText('complete', { timeout: 12000 });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const rr = (ax) => { const tr = document.querySelector(`#viz3d-panel-host .pp-dro tr[data-ax="${ax}"]`); return { w: +tr.children[1].textContent, m: +tr.children[2].textContent }; };
    return { x: rr('x'), y: rr('y'), z: rr('z') };
  });
  expect(Math.abs(r.x.w) + Math.abs(r.y.w) + Math.abs(r.z.w), 'Work tracked the tool (non-zero)').toBeGreaterThan(1);
  // Mach = Work + the G54 TABLE offset, per axis — proves the one-source fix (table, not stale workOrigin {0,0,0})
  expect(r.x.m).toBeCloseTo(r.x.w + 100, 2);
  expect(r.y.m).toBeCloseTo(r.y.w + 200, 2);
  expect(r.z.m).toBeCloseTo(r.z.w + 50, 2);
  expect(r.x.m, 'Mach ≠ Work — the bug symptom is gone').not.toBeCloseTo(r.x.w, 1);
});

test('DRO: switching the active WCS changes Mach (G54 → G55 offset)', async ({ page }) => {
  await setup(page, 'G0 X20 Y10\nM30');
  await page.evaluate(() => {
    const m = window.ddcsGetSettings().machine;
    m.wcs = { active: 1, table: [{ x: 100, y: 200, z: 0 }, { x: -30, y: -40, z: 0 }] };
    m.workOrigin = { x: 0, y: 0, z: 0 };
  });
  const readX = () => { const tr = document.querySelector('#viz3d-panel-host .pp-dro tr[data-ax="x"]'); return { w: +tr.children[1].textContent, m: +tr.children[2].textContent }; };
  await page.locator(RUN).click();
  await expect(page.locator(STATUS)).toContainText('complete', { timeout: 12000 });
  await page.waitForTimeout(200);
  const g54 = await page.evaluate(readX);
  await page.evaluate(() => { window.ddcsGetSettings().machine.wcs.active = 2; });   // switch active → G55
  await page.locator(RUN).click();
  await expect(page.locator(STATUS)).toContainText('complete', { timeout: 12000 });
  await page.waitForTimeout(200);
  const g55 = await page.evaluate(readX);
  expect(g54.m, 'G54: Mach = Work + 100').toBeCloseTo(g54.w + 100, 2);
  expect(g55.m, 'G55: Mach = Work - 30').toBeCloseTo(g55.w - 30, 2);
  expect(g55.m, 'switching the active WCS changed Mach').not.toBeCloseTo(g54.m, 1);
});

test('DRO WCS event: a G55 call updates the active-WCS label + flashes the Work column', async ({ page }) => {
  await setup(page, 'G0 X5\nG55 ( switch WCS )\nG0 X10\nM30');   // no leading G54 → label is the default until the call
  const before = await page.evaluate(() => ({
    flash: !!document.querySelector('#viz3d-panel-host .pp-dro.pp-dro-flash'),
    label: document.querySelector('#viz3d-panel-host .pp-dro-wcs').textContent.trim(),
  }));
  expect(before.flash, 'no flash before any WCS call').toBe(false);
  await page.locator(RUN).click();
  await expect(page.locator(STATUS)).toContainText('complete', { timeout: 12000 });
  const after = await page.evaluate(() => ({
    flash: !!document.querySelector('#viz3d-panel-host .pp-dro.pp-dro-flash'),
    label: document.querySelector('#viz3d-panel-host .pp-dro-wcs').textContent.trim(),
  }));
  expect(after.label, 'the active-WCS label re-referenced to G55').toBe('G55');
  expect(after.flash, 'the WCS call flashed the Work column').toBe(true);
});
