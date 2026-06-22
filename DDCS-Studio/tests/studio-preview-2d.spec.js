import { test, expect } from '@playwright/test';

// Studio's main editor preview is the shared createPreviewPanel — the SAME component as the Blocks tab + wizards.
// Opening the drawer (setGcodeView('3d')) mounts the panel; its single 2D/3D toggle (.pp-mtoggle) shows/hides the
// 2D canvas (.pp-2d). (The old standalone viz3d2d overlay + its viz3dM2d/M3d buttons were folded into the panel.)
test.use({ viewport: { width: 1400, height: 950 } });

test('Studio main preview: the panel 2D/3D toggle swaps the shared 2D view', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.setGcodeView && window.ddcsStudio && window.ddcsStudio.editorManager);
  await page.evaluate(() => window.ddcsStudio.editorManager.setValue('G0 X0 Y0\nG1 X10 Y10 F100\nG1 X20 Y0 F100'));
  await page.evaluate(() => window.setGcodeView('3d'));   // open the preview drawer → mounts the shared panel

  const host = '#viz3d-panel-host';
  await page.waitForSelector(`${host} .pp-2d`, { state: 'attached', timeout: 8000 });

  const cv2dDisplay = () => page.evaluate((h) => {
    const c = document.querySelector(`${h} .pp-2d`);
    return c ? getComputedStyle(c).display : 'missing';
  }, host);

  expect(await cv2dDisplay(), 'starts in 3D (2D canvas hidden)').toBe('none');

  await page.click(`${host} .pp-mtoggle`);
  await page.waitForTimeout(150);
  expect(await cv2dDisplay(), '2D canvas shown after toggling to 2D').not.toBe('none');

  await page.click(`${host} .pp-mtoggle`);
  await page.waitForTimeout(150);
  expect(await cv2dDisplay(), '2D canvas hidden again after toggling back to 3D').toBe('none');

  expect(errs, 'no page errors').toEqual([]);
});
