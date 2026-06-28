import { test, expect } from '@playwright/test';

/**
 * Turn 28 probe-cue refinements (the human verifies the LOOK; this guards the mechanics):
 *  R1 — the DISC emerges from the actual probe CONTACT, not the WCS-projected datum (un-probed axes were forced to 0).
 *  R2 — a re-probe loop (the DDCS macro's GOTO1 retry re-runs the sequence) must re-show the DISC, not stay the stale LINE.
 * Drives the REAL Simulate (the shared preview engine).
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
  await page.waitForTimeout(900);   // let the grow/glow settle
}

test('R1: the disc emerges from the probe CONTACT, not the WCS', async ({ page }) => {
  // move OFF part-zero, then a Z touch-off → the contact is at (12,7,zStop), not (0,0)
  await setup(page, 'G54\nM3 S12000\nG0 X12 Y7\nG31 Z-15 F3000\nM30');
  await run(page);
  const d = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { vis: v._probeDisc.visible, pos: { ...v._probeDisc.position }, contact: v._probeContact };
  });
  expect(d.vis, 'disc shown for the 1-axis probe').toBe(true);
  expect(d.contact, 'the full contact position was recorded').toBeTruthy();
  expect(Math.abs(d.contact.x), 'the contact X is off the WCS (the tool moved to X12 before probing)').toBeGreaterThan(5);
  expect(d.pos.x, 'disc centred at the contact X, not the WCS 0').toBeCloseTo(d.contact.x, 3);
  expect(d.pos.y, 'disc centred at the contact Y, not the WCS 0').toBeCloseTo(d.contact.y, 3);
});

test('R2: a re-probe loop (GOTO1 retry) re-shows the disc, not the stale line', async ({ page }) => {
  // Z (disc) → X (line) → Z again (the loop restarts) ⇒ the cue resets to the disc
  await setup(page, 'G54\nM3 S12000\nG31 Z-15 F3000\nG31 X-10 F3000\nG31 Z-16 F3000\nM30');
  await run(page);
  const s = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { disc: v._probeDisc.visible, line: v._probeLine.visible, axes: { ...v._probeAxes } };
  });
  expect(s.disc, 're-probe → the disc re-appears').toBe(true);
  expect(s.line, 're-probe → the stale line is gone').toBe(false);
  expect(Object.keys(s.axes).filter((a) => s.axes[a]), 'only the re-probed axis is active after the reset').toEqual(['z']);
});
