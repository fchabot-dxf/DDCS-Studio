import { test, expect } from '@playwright/test';

// Uniform preview, step 3: Studio's main editor preview drawer gains the shared 2D/3D toggle. The 2D view is
// the same viz/toolpath2d.js used by the Blocks tab + wizards — so all three previews share one 2D component.
// 2D overlays the GcodeViz3D (additive: the 3D + execution-engine path is untouched).
test.use({ viewport: { width: 1400, height: 950 } });

test('Studio main preview: [2D | 3D] toggle swaps the shared 2D view', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.setGcodeView && window.ddcsStudio && window.ddcsStudio.editorManager);
  await page.evaluate(() => window.ddcsStudio.editorManager.setValue('G0 X0 Y0\nG1 X10 Y10 F100\nG1 X20 Y0 F100'));
  await page.evaluate(() => window.setGcodeView('3d'));   // open the preview drawer (3D is the default inner view)
  await page.waitForTimeout(200);

  const cvDisplay = () => page.evaluate(() => getComputedStyle(document.getElementById('viz3d2d')).display);
  expect(await cvDisplay(), 'starts in 3D (2D overlay hidden)').toBe('none');

  await page.evaluate(() => document.getElementById('viz3dM2d').click());
  await page.waitForTimeout(150);
  expect(await cvDisplay(), '2D view shown after clicking 2D').not.toBe('none');

  await page.evaluate(() => document.getElementById('viz3dM3d').click());
  await page.waitForTimeout(150);
  expect(await cvDisplay(), '2D view hidden again after clicking 3D').toBe('none');

  expect(errs, 'no page errors').toEqual([]);
});
