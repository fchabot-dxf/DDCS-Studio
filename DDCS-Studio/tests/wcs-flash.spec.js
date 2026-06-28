import { test, expect } from '@playwright/test';

/**
 * Slice 2 — WCS VISIBLE (the flash). As the sim reaches a WCS call (G54–G59 / G10) or a spindle/start call (M3/M4),
 * a temporal FLASH fires: the 3D marker glows (createPreviewPanel.onLineChange → viz.flashMarker) AND the code line
 * glows + fades (→ editorManager.flashLine, a CSS keyframe). Classification is from the RAW line text only — zero
 * engine change. This drives the REAL Simulate path (the shared preview engine) + asserts the editor-line flash.
 */
const BASE = process.env.STUDIO_URL || 'http://localhost:3211';
const STEP = '#viz3d-panel-host .pp-step';

test('a WCS call flashes the code line as the sim reaches it (right kind, fades) + the classifier', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ioPanel && typeof window.ddcsGetSettings === 'function' && typeof window.setGcodeView === 'function');

  // classifier unit (the load-bearing logic — raw text only, comments stripped)
  const cls = await page.evaluate(async () => {
    const { classifyCall } = await import('/viz/createPreviewPanel.js');
    return {
      g54: classifyCall('G54   ( work offset )'), g10: classifyCall('G10 L2 P1 X0 Y0'),
      m3: classifyCall('M3 S12000 ( spindle )'), m4: classifyCall('M4 S8000'),
      g53: classifyCall('G53 G0 Z0'), g0: classifyCall('G0 X10 Y10'), m30: classifyCall('M30'),
      comment: classifyCall('( homing uses G54 )'),
    };
  });
  expect(cls).toEqual({ g54: 'wcs', g10: 'wcs', m3: 'start', m4: 'start', g53: null, g0: null, m30: null, comment: null });

  // a program: line 0 = WCS select, line 1 = spindle/start
  await page.locator('#editor').fill('G54 ( work offset )\nM3 S12000 ( spindle on )\nG0 X10 Y10\nG0 Z2\nM30');
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });   // drive Step deterministically
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(STEP, { state: 'attached', timeout: 8000 });

  // STEP → line 0 (G54) executes → the WCS marker glows + the code line flashes amber (flash-wcs)
  await page.locator(STEP).click();
  await expect.poll(async () => page.evaluate(() => {
    const f = document.querySelector('#editor-highlight .g-line.flash-wcs');
    return f ? f.dataset.lineIndex : null;
  }), { timeout: 4000 }).toBe('0');

  // STEP → line 1 (M3) executes → the START marker glows + the code line flashes warm-red (flash-start)
  await page.locator(STEP).click();
  await expect.poll(async () => page.evaluate(() => {
    const f = document.querySelector('#editor-highlight .g-line.flash-start');
    return f ? f.dataset.lineIndex : null;
  }), { timeout: 4000 }).toBe('1');

  // FADES: the flash class is stripped after ~0.75s (the glow is temporal, not sticky)
  await page.waitForTimeout(900);
  const faded = await page.evaluate(() => [...document.querySelectorAll('#editor-highlight .g-line.flash-event')].length);
  expect(faded, 'the flash fades — no line stays flashed').toBe(0);
});
