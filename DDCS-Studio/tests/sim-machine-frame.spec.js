import { test, expect } from '@playwright/test';

// Machine frame (see machine-frame-sim-spec): the envelope + home are FIXED in machine coords (home at scene 0);
// the PART frame (op + stock together) rides the stock's WCS. XY always comes from the WCS table (persistent
// fixture). Z DEFAULTS to the stock resting on the fixed table (you re-zero Z per part → the stored WCS-Z is
// ignored); "Use WCS-Z" forces the work zero to the absolute stored WCS-Z. Changing the WCS moves the part, never
// the envelope.
test.use({ viewport: { width: 1280, height: 900 } });

test('envelope fixed; part rides the WCS in XY; Z = stock-on-table by default, WCS-Z when forced', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const snap = (g54, useWcsZ) => page.evaluate(({ off, useWcsZ }) => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    // Real preview order: stock first, then machine (machine draws the home gated on the part shift).
    // 50×40×20 stock, top datum → bottom 20 below Z0; table floor = min(0,120) = 0 → stock-on-table shift.z = 20.
    viz.setStock({ x: 50, y: 40, z: 20, show: true, datum: 'nnp', pin: 'g54', useWcsZ });
    viz.setMachine({ x: 300, y: 300, z: 120, show: true, wcs: { active: 1, table: [off, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] } });
    const p = (o) => o ? { x: +o.position.x.toFixed(2), y: +o.position.y.toFixed(2), z: +o.position.z.toFixed(2) } : null;
    return { box: p(viz.machineBox), home: p(viz.machineAxes), part: p(viz.partFrame.group) };
  }, { off: g54, useWcsZ });

  // DEFAULT (stock on table): XY rides the WCS; Z = stock-on-table (20), NOT the stored WCS-Z (-10).
  const a = await snap({ x: 100, y: 50, z: -10 }, false);
  expect(a.box, 'envelope centre = travel/2 in machine coords (home at scene 0)').toMatchObject({ x: 150, y: 150, z: 60 });
  expect(a.home, 'machine home at scene 0').toMatchObject({ x: 0, y: 0, z: 0 });
  expect(a.part, 'XY rides the WCS; Z rests on the table (stored WCS-Z ignored)').toMatchObject({ x: 100, y: 50, z: 20 });

  const b = await snap({ x: 200, y: 90, z: -10 }, false);
  expect(b.box, 'envelope did NOT move when the WCS changed').toMatchObject({ x: 150, y: 150, z: 60 });
  expect(b.home, 'home did NOT move').toMatchObject({ x: 0, y: 0, z: 0 });
  expect(b.part, 'only the part XY moved to the new WCS; Z still on the table').toMatchObject({ x: 200, y: 90, z: 20 });

  // FORCE WCS-Z: the work zero goes to the stored absolute WCS-Z (-10); XY still from the WCS.
  const c = await snap({ x: 100, y: 50, z: -10 }, true);
  expect(c.part, 'Use WCS-Z: part Z = the stored absolute WCS-Z').toMatchObject({ x: 100, y: 50, z: -10 });
});
