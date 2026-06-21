import { test, expect } from '@playwright/test';

// Machine frame (see machine-frame-sim-spec): the envelope + home are FIXED in machine coords (home at scene 0);
// the PART frame (op + stock together) rides the STOCK's WCS (its "Sits at WCS" pin → the WCS table offset). So
// op and stock share ONE offset (never diverge), and changing the WCS moves the part, never the envelope.
test.use({ viewport: { width: 1280, height: 900 } });

test('envelope fixed; op+stock ride the stock WCS as a unit; WCS change moves the part only', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const snap = (g54) => page.evaluate((off) => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    // Real preview order: stock first, then machine (machine draws the home gated on the part shift).
    viz.setStock({ x: 50, y: 40, z: 20, show: true, datum: 'nnp', pin: 'g54' });   // stock sits at G54
    viz.setMachine({ x: 300, y: 300, z: 120, show: true, wcs: { active: 1, table: [off, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] } });
    const p = (o) => o ? { x: +o.position.x.toFixed(2), y: +o.position.y.toFixed(2), z: +o.position.z.toFixed(2) } : null;
    return { box: p(viz.machineBox), home: p(viz.machineAxes), part: p(viz.partFrame.group) };
  }, g54);

  const a = await snap({ x: 100, y: 50, z: -10 });
  expect(a.box, 'envelope centre = travel/2 in machine coords (home at scene 0)').toMatchObject({ x: 150, y: 150, z: 60 });
  expect(a.home, 'machine home at scene 0').toMatchObject({ x: 0, y: 0, z: 0 });
  expect(a.part, 'op+stock ride the stock WCS (G54 offset)').toMatchObject({ x: 100, y: 50, z: -10 });

  const b = await snap({ x: 200, y: 90, z: -10 });
  expect(b.box, 'envelope did NOT move when the WCS changed').toMatchObject({ x: 150, y: 150, z: 60 });
  expect(b.home, 'home did NOT move').toMatchObject({ x: 0, y: 0, z: 0 });
  expect(b.part, 'only the part moved to the new WCS offset').toMatchObject({ x: 200, y: 90, z: -10 });
});
