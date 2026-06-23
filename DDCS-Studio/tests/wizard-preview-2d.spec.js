import { test, expect } from '@playwright/test';

// Uniform preview, step 2: the wizard preview is the SAME shared createPreviewPanel as the Blocks tab + Studio
// main (mounted into the wizard's .wiz-viz3d host). Its single 2D/3D toggle (.pp-mtoggle) shows/hides the shared
// 2D canvas (.pp-2d, display:none in 3D); the 3D path is unchanged. (The old standalone .wiz-m2d/.wiz-m3d +
// .wiz-viz2d overlay were folded into the panel — see studio-preview-2d.spec.js for the Studio-main twin.)
test.use({ viewport: { width: 1400, height: 950 } });

test('wizard preview has a 2D/3D toggle that swaps the shared 2D view', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());   // mounts the shared preview panel

  const host = '#wiz_surfacing .wiz-viz3d';                              // the active wizard's panel host
  await page.waitForSelector(`${host} .pp-2d`, { state: 'attached', timeout: 8000 });

  const cv2dDisplay = () => page.evaluate((h) => {
    const c = document.querySelector(`${h} .pp-2d`);
    return c ? getComputedStyle(c).display : 'missing';
  }, host);

  const before = await page.evaluate((h) => ({
    hasToggle: !!document.querySelector(`${h} .pp-mtoggle`),
    hasCanvas: !!document.querySelector(`${h} .pp-2d`),
  }), host);
  expect(before.hasToggle, 'wizard preview has the [2D/3D] toggle').toBe(true);
  expect(before.hasCanvas, 'wizard preview has the shared 2D canvas').toBe(true);
  expect(await cv2dDisplay(), 'defaults to 3D (2D canvas hidden)').toBe('none');

  // Switch to 2D → the shared canvas shows.
  await page.click(`${host} .pp-mtoggle`);
  await page.waitForTimeout(150);
  expect(await cv2dDisplay(), '2D view is shown after toggling to 2D').not.toBe('none');

  // Switch back to 3D → the canvas hides again.
  await page.click(`${host} .pp-mtoggle`);
  await page.waitForTimeout(150);
  expect(await cv2dDisplay(), '2D view hidden again after toggling back to 3D').toBe('none');

  expect(errs, 'no page errors').toEqual([]);
});
