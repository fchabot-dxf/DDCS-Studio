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

test('DRO live: Work tracks the tool + Mach = Work + the active offset (the live-offset graft)', async ({ page }) => {
  await setup(page, 'G54\nG0 X30 Y15\nG1 Z-4 F300\nM30');
  // a non-zero work origin so Mach ≠ Work proves the live addition (not a hardcoded single value)
  await page.evaluate(() => { window.ddcsGetSettings().machine.workOrigin = { x: 100, y: 200, z: 50 }; });
  await page.locator(RUN).click();
  await expect(page.locator(STATUS)).toContainText('complete', { timeout: 12000 });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const off = window.ddcsGetSettings().machine.workOrigin;
    const rr = (ax) => { const tr = document.querySelector(`#viz3d-panel-host .pp-dro tr[data-ax="${ax}"]`); return { w: +tr.children[1].textContent, m: +tr.children[2].textContent }; };
    return { off, x: rr('x'), y: rr('y'), z: rr('z') };
  });
  // Work tracked the tool away from the start (it moved) — the real live symptom
  expect(Math.abs(r.x.w) + Math.abs(r.y.w) + Math.abs(r.z.w), 'Work tracked the tool (non-zero)').toBeGreaterThan(1);
  // Mach = Work + the active offset, per axis — read live, so the future per-WCS table lands for free
  expect(r.x.m).toBeCloseTo(r.x.w + r.off.x, 2);
  expect(r.y.m).toBeCloseTo(r.y.w + r.off.y, 2);
  expect(r.z.m).toBeCloseTo(r.z.w + r.off.z, 2);
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
