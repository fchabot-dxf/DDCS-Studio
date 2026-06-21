import { test, expect } from '@playwright/test';

// The floor grid is LINKED TO THE MACHINE ENVELOPE: it matches the (possibly non-square) footprint, is centred
// on the envelope, lines start at the origin and are clipped to the envelope, and the increment is settable
// (Preview → grid spacing; finer step = more lines). Verified by reading the grid LineSegments geometry.
test.use({ viewport: { width: 1280, height: 900 } });

test('grid matches the envelope footprint and honours the spacing setting', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && typeof p.viz.setGridStep === 'function';
  });

  const r = await page.evaluate(() => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    v.setMachine({ x: 600, y: 300, z: 120, show: true, workOrigin: { x: 0, y: 0, z: 0 } });
    v.fitAll();
    const read = (step) => {
      v.setGridStep(step);
      const p = v.grid.geometry.attributes.position;
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      return { minX, maxX, minY, maxY, count: p.count, pos: { x: v.grid.position.x, y: v.grid.position.y, z: v.grid.position.z } };
    };
    return { s50: read(50), s100: read(100) };
  });

  // Footprint = the envelope (600 × 300), centred on the envelope centre (300,150) at the floor (z=0, since travelZ>0).
  expect(r.s50.maxX - r.s50.minX, 'grid width = |travelX|').toBeCloseTo(600, 1);
  expect(r.s50.maxY - r.s50.minY, 'grid height = |travelY| (rectangular, not square)').toBeCloseTo(300, 1);
  expect(r.s50.pos.x).toBeCloseTo(300, 1);
  expect(r.s50.pos.y).toBeCloseTo(150, 1);
  // A vertical gridline lands on the origin (scene x=0 → local x = -gCx = -300), i.e. lines start at the origin.
  expect(r.s50.minX, 'left edge / origin line at local -300').toBeCloseTo(-300, 1);
  // Finer spacing → more vertices.
  expect(r.s50.count, '50mm grid is denser than 100mm').toBeGreaterThan(r.s100.count);
});
