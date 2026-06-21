import { test, expect } from '@playwright/test';

// The stock always rests on a table/bed, drawn at the stock's BOTTOM — so it sits on a surface wherever part-zero
// is: at Z0 for a table-zero datum (bottom-Z), a height below Z0 for a stock-top-zero datum (top-Z).
test.use({ viewport: { width: 1280, height: 900 } });

test('table/bed sits at the stock bottom for any datum', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    const z = (datum) => { viz.setStock({ x: 60, y: 40, z: 25, show: true, datum }); return viz.tableMesh ? viz.tableMesh.position.z : null; };
    return { top: z('ccp'), table: z('ccn') };
  });

  expect(r.top, 'stock-top zero: table a full height below Z0').toBeCloseTo(-25, 1);
  expect(r.table, 'table zero: table at Z0').toBeCloseTo(0, 1);
});
