import { test, expect } from '@playwright/test';

// True trail thickness without GL linewidth (capped at 1px on ANGLE): the trail line gets 4 child copies that
// share its geometry/colours/visibility, offset ±right/±up in screen space so the bold path renders a few px wide.
test.use({ viewport: { width: 1280, height: 900 } });

test('trail renders as fat offset copies (thickness independent of GL linewidth)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._trailFat && p.viz._trailFat.length === 4;
  });
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    const fat = viz._trailFat || [];
    return {
      count: fat.length,
      sharesGeom: fat.every((c) => c.geometry === viz._trailLine.geometry),
      childOfTrail: fat.every((c) => c.parent === viz._trailLine),
      maxOffset: Math.max(...fat.map((c) => c.position.length())),
    };
  });
  expect(r.count, 'four fat copies').toBe(4);
  expect(r.sharesGeom, 'they share the trail geometry (inherit draw-range/tip/colour)').toBeTruthy();
  expect(r.childOfTrail, 'they are children of the trail line (inherit visibility)').toBeTruthy();
  expect(r.maxOffset, 'offset ±right/±up gives real thickness').toBeGreaterThan(0);
});
