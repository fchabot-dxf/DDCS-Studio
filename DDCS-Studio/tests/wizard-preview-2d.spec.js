import { test, expect } from '@playwright/test';

// Uniform preview, step 2: the wizard 3D preview gains a shared 2D/3D toggle + Play (same 2D view as the
// Blocks tab, via viz/toolpath2d.js). The 2D canvas overlays the GcodeViz3D and is shown/hidden by the toggle;
// the 3D path is unchanged. (DOM is created before the GcodeViz3D init, so this holds even if 3D init no-ops.)
test.use({ viewport: { width: 1400, height: 950 } });

test('wizard preview has a 2D/3D toggle that swaps the shared 2D view', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForSelector('.wiz-viz3d .wiz-m2d', { timeout: 8000 });

  const before = await page.evaluate(() => {
    const cv = document.querySelector('.wiz-viz3d .wiz-viz2d');
    return {
      hasToggle: !!document.querySelector('.wiz-viz3d .wiz-m2d') && !!document.querySelector('.wiz-viz3d .wiz-m3d'),
      hasCanvas: !!cv,
      canvasDisplay: cv ? getComputedStyle(cv).display : 'missing',
    };
  });
  expect(before.hasToggle, 'wizard preview has a [2D | 3D] toggle').toBe(true);
  expect(before.hasCanvas, 'wizard preview has the shared 2D canvas').toBe(true);
  expect(before.canvasDisplay, 'defaults to 3D (2D canvas hidden)').toBe('none');

  // Switch to 2D → the shared canvas shows.
  await page.evaluate(() => document.querySelector('.wiz-viz3d .wiz-m2d').click());
  await page.waitForTimeout(150);
  const in2d = await page.evaluate(() => getComputedStyle(document.querySelector('.wiz-viz3d .wiz-viz2d')).display);
  expect(in2d, '2D view is shown after clicking 2D').not.toBe('none');

  // Switch back to 3D → the canvas hides again.
  await page.evaluate(() => document.querySelector('.wiz-viz3d .wiz-m3d').click());
  await page.waitForTimeout(150);
  const back3d = await page.evaluate(() => getComputedStyle(document.querySelector('.wiz-viz3d .wiz-viz2d')).display);
  expect(back3d, '2D view hidden again after clicking 3D').toBe('none');

  expect(errs, 'no page errors').toEqual([]);
});
