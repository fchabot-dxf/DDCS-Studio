import { test, expect } from '@playwright/test';

/**
 * Slice 3 — PROBE per-axis touch + the two distinct WCS, rendered by DIMENSION. Each G31 determines a PLANE, so the
 * probe-WCS REDUCES as axes are probed: 1 axis → a DISC (the plane perp to it), 2 axes → a LINE (the planes' intersection
 * along the un-probed axis), 3 axes → the POINT (the datum). Off-stock is NOT clamped (the correctness signal). The
 * probe-WCS is a blue PEER of the amber stock-WCS. No engine change (the engine clamps G31 to the contact; the tool's
 * position at completion is the contact). Drives the REAL Simulate (the shared preview engine).
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
async function runAndShape(page) {
  await page.locator(RUN).click();
  await expect(page.locator(STATUS)).toContainText('complete', { timeout: 12000 });
  await page.waitForTimeout(900);
  return page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return {
      disc: { vis: v._probeDisc.visible, pos: { ...v._probeDisc.position } },
      line: { vis: v._probeLine.visible, pos: { ...v._probeLine.position } },
      point: { vis: v._probeGizmo.visible, pos: { ...v._probeGizmo.position } },
      probeColor: v._probeGizmo.material.color.getHex(),
    };
  });
}

test('probeAxis classifier + two distinct WCS peers', async ({ page }) => {
  await setup(page, 'G54\nM3 S12000\nG31 Z-15 F3000\nM30');
  const pa = await page.evaluate(async () => {
    const { probeAxis } = await import('/viz/createPreviewPanel.js');
    return { z: probeAxis('G31 Z-10 F50'), x: probeAxis('G31 X20'), y: probeAxis('G31 Y5'), none: probeAxis('G0 X10'), noax: probeAxis('G31 F50') };
  });
  expect(pa).toEqual({ z: 'z', x: 'x', y: 'y', none: null, noax: null });
  const peers = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { distinct: v._probeGizmo !== v._originGizmo, probe: v._probeGizmo.material.color.getHex(), stock: v._originGizmo.children.find((c) => c.geometry && c.geometry.type === 'SphereGeometry')?.material.color.getHex() };
  });
  expect(peers.distinct).toBe(true);
  expect(peers.probe, 'probe-WCS is blue').toBe(0x4f8fff);
  expect(peers.stock, 'a different colour from the amber stock-WCS').not.toBe(peers.probe);
});

test('1-axis probe (Z touch-off) → a DISC in the perp (XY) plane', async ({ page }) => {
  await setup(page, 'G54\nM3 S12000\nG31 Z-15 F3000 ( Z touch-off )\nM30');
  const s = await runAndShape(page);
  expect(s.disc.vis, 'a single-axis probe shows a DISC (the determined plane)').toBe(true);
  expect(s.line.vis, 'not a line').toBe(false);
  expect(s.point.vis, 'the predicted origin point is ALWAYS shown (on the disc)').toBe(true);
  expect(Math.abs(s.disc.pos.z) > 0.5, 'the disc sits at the probed Z (off part-zero)').toBe(true);
});

test('2-axis probe (Z + X) → a LINE along the un-probed Y', async ({ page }) => {
  await setup(page, 'G54\nM3 S12000\nG31 Z-15 F3000\nG31 X-25 F3000\nM30');
  const s = await runAndShape(page);
  expect(s.line.vis, 'two axes → a LINE (the planes intersect)').toBe(true);
  expect(s.disc.vis).toBe(false);
  expect(s.point.vis, 'the predicted origin point is ALWAYS shown (on the line)').toBe(true);
});

test('3-axis probe (Z + X + Y) → the POINT (the datum)', async ({ page }) => {
  await setup(page, 'G54\nM3 S12000\nG31 Z-15 F3000\nG31 X-25 F3000\nG31 Y-20 F3000\nM30');
  const s = await runAndShape(page);
  expect(s.point.vis, 'three axes → the POINT datum').toBe(true);
  expect(s.disc.vis).toBe(false);
  expect(s.line.vis).toBe(false);
  expect(Math.abs(s.point.pos.x) > 0.5 || Math.abs(s.point.pos.z) > 0.5, 'the datum is off part-zero (built from the probes)').toBe(true);
});
