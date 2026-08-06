import { test, expect } from '@playwright/test';

// The 2D coord tooltip SNAPS to geometry near the pointer (stock corners + centre, path nodes, origin): the
// readout jumps to the exact world coord and a cyan marker shows the snap. Verified by hovering a few px off a
// known stock corner and reading the snapped cursor.
test.use({ viewport: { width: 1280, height: 900 } });

test('2D readout snaps to a stock corner', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsInteractive === '1');
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { x: 100, y: 80, z: 20, shape: 'boss', show: true, datum: 'nnp', pin: 'origin' }; });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  // Switch to 2D and get the world→screen transform + canvas rect. Stock (datum nnp) corners: (0,0)…(100,80).
  const geo = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    panel.setView('2d');
    const cv = panel.el.querySelector('.pp-2d');
    const v = cv.__t2view, rect = cv.getBoundingClientRect();
    const S = (wx, wy) => ({ sx: rect.left + (v.ox + wx * v.scale), sy: rect.top + (v.oy - wy * v.scale) });
    return { corner: S(100, 0), edgeMid: S(50, 80), rectLeft: rect.left, rectTop: rect.top };
  });
  const read = () => page.evaluate(() => window.ddcsStudio.wizardManager._activePanel.el.querySelector('.pp-2d').__t2cursor);

  // (1) near a CORNER → snaps to the exact corner (100,0).
  await page.mouse.move(geo.corner.sx + 4, geo.corner.sy - 4);
  await page.waitForTimeout(50);
  const c = await read();
  expect(c.snapped, 'corner: snapped').toBe(true);
  expect(c.x).toBeCloseTo(100, 0); expect(c.y).toBeCloseTo(0, 0);

  // (2) a few px off the TOP EDGE midpoint → snaps onto the edge (y=80, x≈50), proving EDGE snapping.
  await page.mouse.move(geo.edgeMid.sx, geo.edgeMid.sy - 5);
  await page.waitForTimeout(50);
  const e = await read();
  expect(e.snapped, 'edge: snapped').toBe(true);
  expect(e.y, 'snapped onto the top edge y=80').toBeCloseTo(80, 0);
  expect(e.x, 'projected to ~x=50 on the edge').toBeCloseTo(50, 0);

  // (3) empty region (canvas top-left, inside the fit padding) → free coord, not snapped.
  await page.mouse.move(geo.rectLeft + 22, geo.rectTop + 22);
  await page.waitForTimeout(50);
  const free = await read();
  expect(free && free.snapped, 'free coord away from geometry (or no readout)').toBeFalsy();
});
