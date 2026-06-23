import { test, expect } from '@playwright/test';

// The grid IS the table and it's FIXED at the machine floor. The stock always RESTS on it (its bottom on the floor)
// for any datum — the datum changes where Z0 sits, not where the table is (see gcodeViz3d _partShift: default Z =
// tableFloor − stockBottom). So a top-datum and a bottom-datum stock both sit on the same fixed floor.
test.use({ viewport: { width: 1280, height: 900 } });

test('stock always rests on the fixed grid/table floor (any datum)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.THREE);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const THREE = window.THREE, viz = window.ddcsStudio.wizardManager._activePanel.viz;
    const probe = (datum) => {
      viz.setStock({ x: 60, y: 40, z: 25, show: true, datum, pin: 'origin' });
      viz.setMachine({ x: 300, y: 300, z: 120, show: true });   // table floor = min(0,120) = 0
      viz.fitAll(); viz.scene.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(viz.stockMesh);
      return { floor: +viz._gridParams.floor.toFixed(2), stockMinZ: +b.min.z.toFixed(2), tableVisible: !!(viz.tableMesh && viz.tableMesh.visible) };
    };
    return { top: probe('ccp'), table: probe('ccn') };
  });

  // The floor is the fixed machine table (z=0 here), the same for any datum.
  expect(r.top.floor, 'floor fixed at the machine table').toBeCloseTo(0, 1);
  expect(r.table.floor, 'floor fixed at the machine table').toBeCloseTo(0, 1);
  // The stock bottom rests ON that floor for BOTH datums (the datum moves Z0, not the table).
  expect(r.top.stockMinZ, 'top-datum stock rests on the floor').toBeCloseTo(r.top.floor, 1);
  expect(r.table.stockMinZ, 'table-datum stock rests on the floor').toBeCloseTo(r.table.floor, 1);
  expect(r.top.tableVisible && r.table.tableVisible, 'the grid/table surface is shown').toBe(true);
});
