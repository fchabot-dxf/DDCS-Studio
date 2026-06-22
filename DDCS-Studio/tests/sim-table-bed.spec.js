import { test, expect } from '@playwright/test';

// The grid IS the table: a single floor (machine frame) at the stock's BOTTOM — so the stock always rests ON it
// wherever part-zero is: Z0 for a table-zero datum (bottom-Z), a height below Z0 for a stock-top-zero datum (top-Z).
// (Replaced the old part-riding bed; the floor is now the grid/table plane — see gcodeViz3d _layoutGrid + fit.)
test.use({ viewport: { width: 1280, height: 900 } });

test('grid/table floor sits at the stock bottom for any datum', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    // setStock records the datum-aware floor; fitAll lays the grid/table out → read the actual floor + the table mesh.
    const z = (datum) => { viz.setStock({ x: 60, y: 40, z: 25, show: true, datum }); viz.fitAll(); return { floor: viz._gridParams ? viz._gridParams.floor : null, tableVisible: !!(viz.tableMesh && viz.tableMesh.visible) }; };
    return { top: z('ccp'), table: z('ccn') };
  });

  expect(r.top.floor, 'stock-top zero: floor a full height below Z0').toBeCloseTo(-25, 1);
  expect(r.table.floor, 'table zero: floor at Z0').toBeCloseTo(0, 1);
  expect(r.top.tableVisible && r.table.tableVisible, 'the grid/table surface is shown under the stock').toBe(true);
});
