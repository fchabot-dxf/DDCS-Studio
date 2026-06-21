import { test, expect } from '@playwright/test';

// The two real-machine zeroing workflows are already expressed by the stock datum's Z level:
//   • stock-top zero (zero Z on the stock surface) = a top-Z datum → the stock hangs BELOW Z0 (cuts go negative)
//   • table zero (tools measured, Z0 at the table) = a bottom-Z datum → the stock sits ON Z0 (top at Z = height)
test.use({ viewport: { width: 1280, height: 900 } });

test('stock datum Z sets the sim zero plane (stock-top vs table)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.THREE);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const THREE = window.THREE;
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    const Z = 20;
    const boundsFor = (datum) => {
      viz.setStock({ x: 50, y: 40, z: Z, show: true, datum });
      viz.scene.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(viz.stockMesh);
      return { minZ: b.min.z, maxZ: b.max.z };
    };
    return { Z, top: boundsFor('ccp'), table: boundsFor('ccn') };
  });

  // stock-top zero: top surface at Z0, body below
  expect(r.top.maxZ, 'stock-top: top at Z0').toBeCloseTo(0, 1);
  expect(r.top.minZ, 'stock-top: body below Z0').toBeCloseTo(-r.Z, 1);
  // table zero: bottom on the table (Z0), body above
  expect(r.table.minZ, 'table: bottom at Z0').toBeCloseTo(0, 1);
  expect(r.table.maxZ, 'table: top at Z=height').toBeCloseTo(r.Z, 1);
});
