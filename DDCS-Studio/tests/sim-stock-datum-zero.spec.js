import { test, expect } from '@playwright/test';

// The two real-machine zeroing workflows are expressed by the stock datum's Z level. In the machine-frame sim the
// stock ALWAYS rests on the fixed table; the datum decides where Z0 (part-zero) sits:
//   • stock-top zero (top-Z datum)   → Z0 at the stock TOP (you touch off the surface) — a full height above the table
//   • table zero    (bottom-Z datum) → Z0 at the table (you measure tools / touch off the table)
test.use({ viewport: { width: 1280, height: 900 } });

test('stock datum Z sets where Z0 sits; the stock still rests on the table (stock-top vs table)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.THREE);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const THREE = window.THREE, viz = window.ddcsStudio.wizardManager._activePanel.viz;
    const Z = 20;
    const probe = (datum) => {
      viz.setStock({ x: 50, y: 40, z: Z, show: true, datum, pin: 'origin' });
      viz.setMachine({ x: 300, y: 300, z: 120, show: true });   // table floor = 0
      viz.scene.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(viz.stockMesh);
      return { minZ: +b.min.z.toFixed(2), maxZ: +b.max.z.toFixed(2), z0: +viz.partFrame.shift.z.toFixed(2) };
    };
    return { Z, top: probe('ccp'), table: probe('ccn') };
  });

  // Both rest on the table (bottom at the machine floor, z=0).
  expect(r.top.minZ, 'stock-top datum: stock still rests on the table').toBeCloseTo(0, 1);
  expect(r.table.minZ, 'table datum: stock rests on the table').toBeCloseTo(0, 1);
  // Z0 (part-zero) sits where you touched off:
  expect(r.top.z0, 'stock-top zero: Z0 at the stock top — a full height above the table').toBeCloseTo(r.Z, 1);
  expect(r.table.z0, 'table zero: Z0 at the table').toBeCloseTo(0, 1);
});
