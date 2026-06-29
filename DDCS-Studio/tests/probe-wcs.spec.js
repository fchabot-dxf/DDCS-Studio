import { test, expect } from '@playwright/test';

/**
 * Probe-WCS cue — TRANSIENT-DISC model (advisor turn 30). Each probe drops a transient feed-sized soft disc at its
 * contact (self-fades; covered by probe-anim-pipeline/visible). The PERSISTENT layer is the DATUM (a RED 2-axis
 * crosshair, where the probed planes cross — shown ≥2 axes). The axis line was REMOVED (user); _probeLine stays as a hidden object
 * (never shown) + _lineColor remains the disc colour. Drives the REAL Simulate.
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
async function runShape(page) {
  await page.locator(RUN).click();
  await expect(page.locator(STATUS)).toContainText('complete', { timeout: 15000 });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return {
      datum: { vis: v._probeGizmo.visible, color: v._probeCross.material.color.getHex() },   // datum = a RED 2-axis crosshair (LineSegments _probeCross)
      line: { vis: v._probeLine.visible, color: v._probeLine.material.color.getHex() },
    };
  });
}

test('probeAxis classifier + the DATUM is a distinct-colour peer of the stock-WCS', async ({ page }) => {
  await setup(page, 'G54\nM3 S12000\nG31 Z-15 F3000\nM30');
  const pa = await page.evaluate(async () => {
    const { probeAxis } = await import('/viz/createPreviewPanel.js');
    return { z: probeAxis('G31 Z-10 F50'), zVar: probeAxis('G31 Z#5 F#9'), x: probeAxis('G31 X20'), none: probeAxis('G0 X10') };
  });
  expect(pa).toEqual({ z: 'z', zVar: 'z', x: 'x', none: null });   // #var axis values must match (the ada5907 fix)
  const peers = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { datum: v._datumColor, line: v._lineColor, stock: v._originGizmo.children.find((c) => c.geometry && c.geometry.type === 'SphereGeometry')?.material.color.getHex() };
  });
  expect(peers.datum, 'datum is RED (crosshair)').toBe(0xff2d2d);
  expect(peers.line, 'axis line is CYAN, a different colour from the datum').toBe(0x00e5ff);
  expect(peers.datum, 'datum colour differs from the amber stock-WCS').not.toBe(peers.stock);
});

test('1-axis probe → no persistent datum/line yet (one plane, nothing crosses)', async ({ page }) => {
  await setup(page, 'G54\nM3 S12000\nG31 Z-15 F3000\nM30');
  const s = await runShape(page);
  expect(s.datum.vis, 'no datum from a single plane').toBe(false);
  expect(s.line.vis, 'no line from a single plane').toBe(false);
});

test('2-axis probe → the DATUM (red crosshair) shows; the axis line is REMOVED (user)', async ({ page }) => {
  // DATUM follows the WCS-WRITE (turn 112): probe Z & X and WRITE the WCS Z/X (#[#70+2]/#[#70+0]) → the datum shows.
  await setup(page, 'G54\nM3 S12000\n#70=805\nG31 Z-15 F3000\n#[#70+2]=-15\nG31 X-25 F3000\n#[#70+0]=-25\nM30');
  const s = await runShape(page);
  expect(s.datum.vis, 'the datum shows once two WCS axes are written').toBe(true);
  expect(s.datum.color).toBe(0xff2d2d);
  expect(s.line.vis, 'the axis line was removed — it never shows now').toBe(false);
});

test('Z-first datum: a COMPED (bracketed) WCS write lands the datum on the SURFACE, not the contact', async ({ page }) => {
  // REGRESSION (turn 116 comp → turn 120 fix): the comp turned the Z-first WCS write into a BRACKETED expr
  // `#[#73]=[#1927-#6]` that the old single-var-RHS regex missed → the Z write wasn't detected → the datum Z fell back to
  // the contact MEAN (the wall-scan depth, a tip-radius too low). The hook now reads the engine's COMMITTED target value
  // (robust to any expression) → the datum Z drops a stylus-radius (#6=2) onto the true surface.
  await setup(page, 'G54\nM3 S12000\n#70=805\n#6=2\nG31 Z-50 F3000\n#73=[#70+2]\n#[#73]=[#1927-#6]\nG31 X-25 F3000\n#[#70+0]=[#1925-#6]\nM30');
  await page.locator(RUN).click();
  await expect(page.locator(STATUS)).toContainText('complete', { timeout: 15000 });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { datumZ: +v._probeGizmo.position.z.toFixed(3), contactZ: +v._probeVals.z.toFixed(3), vis: v._probeGizmo.visible };
  });
  expect(r.vis, 'the datum shows (Z + X written)').toBe(true);
  expect(r.datumZ, 'datum Z = the comped surface = contact − stylus radius (2), NOT the raw contact').toBeCloseTo(r.contactZ - 2, 1);
});

test('3-axis probe → the DATUM point (no line — three planes cross at a point)', async ({ page }) => {
  await setup(page, 'G54\nM3 S12000\n#70=805\nG31 Z-15 F3000\n#[#70+2]=-15\nG31 X-25 F3000\n#[#70+0]=-25\nG31 Y-20 F3000\n#[#70+1]=-20\nM30');
  const s = await runShape(page);
  expect(s.datum.vis, 'three written WCS axes → a datum point').toBe(true);
  expect(s.line.vis, 'no line at 3 axes (it collapsed to the point)').toBe(false);
});
