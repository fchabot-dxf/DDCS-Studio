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

test('REAL DATUM: the un-written axis rides the contact, not the WCS', async ({ page }) => {
  // DATUM follows the WCS-WRITE (turn 112). Probe X & Y at Z=-3 and WRITE the WCS X/Y (#[#70+0]/#[#70+1]) → the datum
  // shows at the written X/Y; its UN-written Z rides the contact (-3), not 0 (the WCS). (Discs come from the probes.)
  await setup(page, 'G54\nM3 S12000\n#70=805\nG0 Z-3\nG31 X-10 F600\n#[#70+0]=-5\nG31 Y-8 F600\n#[#70+1]=-5\nM30');
  await run(page);
  const d = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { datumVis: v._probeGizmo.visible, lineVis: v._probeLine.visible, z: v._probeGizmo.position.z, contactZ: v._probeContact && v._probeContact.z };
  });
  expect(d.datumVis, 'datum shows once the WCS X/Y are written').toBe(true);
  expect(d.lineVis, 'the axis line was removed (user) — never shows').toBe(false);
  expect(Math.abs(d.contactZ), 'the probe happened off the WCS Z (at Z-3)').toBeGreaterThan(1);
  expect(d.z, 'datum Z = the contact Z (un-written), NOT the WCS 0').toBeCloseTo(d.contactZ, 2);
});

test('a re-probe REFINES the axis (fast→slow), it does NOT reset the accumulated axes', async ({ page }) => {
  // Z (fast) → X (fast) → Z (slow, a fine refinement); WRITE Z then X (the datum source) — the cue must KEEP {z,x}.
  await setup(page, 'G54\nM3 S12000\n#70=805\nG31 Z-15 F3000\n#[#70+2]=-15\nG31 X-10 F3000\n#[#70+0]=-10\nG31 Z-16 F50\n#[#70+2]=-16\nM30');
  await run(page);
  const s = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { datum: v._probeGizmo.visible, line: v._probeLine.visible, axes: Object.keys(v._probeAxes).filter((a) => v._probeAxes[a]).sort() };
  });
  expect(s.axes, 'the slow re-probe refined Z, keeping both axes').toEqual(['x', 'z']);
  expect(s.line, 'the axis line was removed (user) — never shows').toBe(false);
  expect(s.datum, 'datum shown (Z + X written)').toBe(true);
});

test('FEED → SIZE (t319 flip): a SLOWER probe makes a BIGGER disc than a faster probe (slow=bigger, matching the 2D pulse)', async ({ page }) => {
  await setup(page, 'G54\nG31 Z-15 F3000\nM30');
  const r = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { slow: v._burstRadiusPx(50), fast: v._burstRadiusPx(3000), mid: v._burstRadiusPx(250) };
  });
  expect(r.slow, 'slow (F50) disc is BIGGER than fast (F3000) — t319 flipped faster-bigger → slow-bigger').toBeGreaterThan(r.fast);
  expect(r.slow).toBeGreaterThan(r.mid);
  expect(r.fast).toBeLessThan(r.mid);
});
