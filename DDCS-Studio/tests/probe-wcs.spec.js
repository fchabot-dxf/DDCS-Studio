import { test, expect } from '@playwright/test';

/**
 * Slice 3 — PROBE per-axis touch animation + the two distinct WCS. As each G31 finishes (the engine already clamps it
 * to the contact — probeGeometry.stockProbeStop, #1925-1927; no engine change), the probe-WCS builds PER-AXIS: the
 * probed axis line flashes, the point glows, and its axis converges to the contact (the tool's part-local position).
 * The probe-WCS is a PEER of the stock-WCS — same size, EQUAL importance, different COLOUR (blue vs amber), always
 * visible, starts superimposed. It can land OFF the stock (no clamp) — that's the correctness signal.
 */
const BASE = process.env.STUDIO_URL || 'http://localhost:3211';
const RUN = '#viz3d-panel-host .pp-run';
const STATUS = '#viz3d-panel-host .pp-status';

test('a probe builds the probe-WCS per-axis (Z first), a distinct blue peer of the stock-WCS', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ioPanel && typeof window.ddcsGetSettings === 'function' && typeof window.setGcodeView === 'function');

  // probeAxis unit — which axis each G31 touches (the per-axis driver)
  const pa = await page.evaluate(async () => {
    const { probeAxis } = await import('/viz/createPreviewPanel.js');
    return { z: probeAxis('G31 Z-10 F50'), x: probeAxis('G31 X20 F50'), y: probeAxis('G31 Y5'), none: probeAxis('G0 X10 Y10'), noax: probeAxis('G31 F50') };
  });
  expect(pa).toEqual({ z: 'z', x: 'x', y: 'y', none: null, noax: null });

  // a probe program: Z touch-off FIRST, then an X edge
  await page.locator('#editor').fill('G54 ( wcs )\nM3 S12000\nG31 Z-15 F3000 ( Z touch-off )\nG31 X-25 F3000 ( X edge )\nM30');
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(RUN, { state: 'attached', timeout: 8000 });

  // TWO DISTINCT markers: a blue probe-WCS peer of the amber stock-WCS, always visible, superimposed at part-zero
  const before = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return {
      hasProbe: !!v._probeGizmo, hasStock: !!v._originGizmo, distinct: v._probeGizmo !== v._originGizmo,
      probeColor: v._probeGizmo.material.color.getHex(), stockDot: v._originGizmo.children.find((c) => c.geometry && c.geometry.type === 'SphereGeometry')?.material.color.getHex(),
      visible: v._probeGizmo.visible, pos0: { x: v._probeGizmo.position.x, y: v._probeGizmo.position.y, z: v._probeGizmo.position.z },
    };
  });
  expect(before.hasProbe && before.hasStock && before.distinct, 'two distinct WCS markers (probe ≠ stock)').toBe(true);
  expect(before.probeColor, 'probe-WCS is blue').toBe(0x4f8fff);
  expect(before.stockDot, 'a different colour from the amber stock-WCS dot').not.toBe(before.probeColor);
  expect(before.visible, 'the probe-WCS is always visible').toBe(true);
  expect(before.pos0, 'starts superimposed on the stock-WCS (part-zero)').toEqual({ x: 0, y: 0, z: 0 });

  // RUN → the probes execute; the probe-WCS builds per-axis, converging to each contact
  await page.locator(RUN).click();
  await expect(page.locator(STATUS)).toContainText('complete', { timeout: 12000 });
  await page.waitForTimeout(800);   // let the per-axis convergence animation settle

  const after = await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return {
      probe: { x: v._probeGizmo.position.x, y: v._probeGizmo.position.y, z: v._probeGizmo.position.z },
      tool: { x: v._animTool.position.x, y: v._animTool.position.y, z: v._animTool.position.z },
    };
  });
  // the PROBED axes (Z, X) built to the tool's contact (the per-axis convergence); Y (unprobed) stays superimposed.
  expect(Math.abs(after.probe.z - after.tool.z), 'Z axis built to the Z-probe contact').toBeLessThan(0.6);
  expect(Math.abs(after.probe.x - after.tool.x), 'X axis built to the X-probe contact').toBeLessThan(0.6);
  expect(after.probe.y, 'the unprobed Y axis stays superimposed (part-zero)').toBe(0);
  expect(Math.abs(after.tool.x) > 0.5 || Math.abs(after.tool.z) > 0.5, 'the probes actually moved the datum off part-zero').toBe(true);
});
