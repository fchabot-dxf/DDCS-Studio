import { test, expect } from '@playwright/test';

/**
 * Probe-cue mechanics (the human verifies the LOOK; this guards the logic), TRANSIENT-DISC model (turn 30):
 *  • REAL DATUM — the persistent datum/line sit at the real datum: un-probed axes ride the CONTACT, not the WCS (0).
 *  • R2 — a re-probe loop (GOTO1 retry) clears the persistent layer so it doesn't linger from the previous loop.
 *  • FEED → SIZE — a slow/fine probe makes a BIGGER disc than a fast/rough probe.
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
async function run(page) {
  await page.locator(RUN).click();
  await expect(page.locator(STATUS)).toContainText('complete', { timeout: 15000 });
  await page.waitForTimeout(400);
}

test('REAL DATUM: the un-probed axis rides the contact, not the WCS', async ({ page }) => {
  // a corner-style probe at Z = -3: probe X then Y → the datum's un-probed Z must be the contact (-3), not 0 (the WCS)
  await setup(page, 'G54\nM3 S12000\nG0 Z-3\nG31 X-10 F600\nG31 Y-8 F600\nM30');
  await run(page);
  const d = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { datumVis: v._probeGizmo.visible, lineVis: v._probeLine.visible, z: v._probeGizmo.position.z, contactZ: v._probeContact && v._probeContact.z };
  });
  expect(d.datumVis, 'datum shows for the 2-axis corner').toBe(true);
  expect(d.lineVis, 'the axis line shows (along the un-probed Z)').toBe(true);
  expect(Math.abs(d.contactZ), 'the probe happened off the WCS Z (at Z-3)').toBeGreaterThan(1);
  expect(d.z, 'datum Z = the contact Z, NOT the WCS 0').toBeCloseTo(d.contactZ, 2);
});

test('a re-probe REFINES the axis (fast→slow), it does NOT reset the accumulated axes', async ({ page }) => {
  // Z (fast) → X (fast) → Z (slow, a fine refinement) — the cue must KEEP {z,x}, not reset to {z}
  await setup(page, 'G54\nM3 S12000\nG31 Z-15 F3000\nG31 X-10 F3000\nG31 Z-16 F50\nM30');
  await run(page);
  const s = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { datum: v._probeGizmo.visible, line: v._probeLine.visible, axes: Object.keys(v._probeAxes).filter((a) => v._probeAxes[a]).sort() };
  });
  expect(s.axes, 'the slow re-probe refined Z, keeping both axes').toEqual(['x', 'z']);
  expect(s.line, 'still a 2-axis line (not reset)').toBe(true);
  expect(s.datum, 'datum still shown (not reset)').toBe(true);
});

test('FEED → SIZE: a SLOWER probe makes a SMALLER disc than a faster probe', async ({ page }) => {
  await setup(page, 'G54\nG31 Z-15 F3000\nM30');
  const r = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { slow: v._burstRadiusPx(50), fast: v._burstRadiusPx(3000), mid: v._burstRadiusPx(250) };
  });
  expect(r.slow, 'slow (F50) disc is SMALLER than fast (F3000)').toBeLessThan(r.fast);
  expect(r.slow).toBeLessThan(r.mid);
  expect(r.fast).toBeGreaterThan(r.mid);
});
