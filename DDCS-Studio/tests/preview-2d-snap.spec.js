import { test, expect } from '@playwright/test';

// The 2D coord tooltip SNAPS to geometry near the pointer (stock corners + centre, path nodes, origin): the
// readout jumps to the exact world coord and a cyan marker shows the snap. Verified by hovering a few px off a
// known stock corner and reading the snapped cursor.
test.use({ viewport: { width: 1280, height: 900 } });

test('2D readout snaps to a stock corner', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { x: 100, y: 80, z: 20, shape: 'boss', show: true, datum: 'nnp', pin: 'origin' }; });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  // Switch to 2D and compute the screen position of the stock corner (100, 0) (datum nnp → corner at maxX,minY).
  const corner = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    panel.setView('2d');
    const cv = panel.el.querySelector('.pp-2d');
    const v = cv.__t2view, rect = cv.getBoundingClientRect();
    return { sx: rect.left + (v.ox + 100 * v.scale), sy: rect.top + (v.oy - 0 * v.scale) };
  });

  await page.mouse.move(corner.sx + 4, corner.sy - 4);   // hover a few px off the corner
  await page.waitForTimeout(60);

  const cur = await page.evaluate(() => window.ddcsStudio.wizardManager._activePanel.el.querySelector('.pp-2d').__t2cursor);
  expect(cur, 'cursor present').toBeTruthy();
  expect(cur.snapped, 'snapped to geometry').toBe(true);
  expect(cur.x, 'snapped to corner X=100').toBeCloseTo(100, 1);
  expect(cur.y, 'snapped to corner Y=0').toBeCloseTo(0, 1);

  // Hovering far from any geometry → free coord (not snapped).
  await page.mouse.move(corner.sx + 0, corner.sy - 120);
  await page.waitForTimeout(60);
  const free = await page.evaluate(() => window.ddcsStudio.wizardManager._activePanel.el.querySelector('.pp-2d').__t2cursor);
  expect(free.snapped, 'free coord away from geometry').toBeFalsy();
});
