import { test, expect } from '@playwright/test';

// Machine-frame axis labels point in the TRUE coordinate directions: +X / +Y always sit at the +scene end
// (where the DRO grows) regardless of the home/travel sign — the home direction is shown by the envelope, not
// the labels. Each label sits at the CENTRE of its envelope edge (the colored axis LINES stay on zero, but the
// text reads cleaner at the edge mid). Verified by driving the shared 3D viz and reading the sprite positions.
test.use({ viewport: { width: 1280, height: 900 } });

test('axis labels point in true coordinate directions and sit at envelope edge centres (no config flip)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._gridLabels;
  });

  const probe = await page.evaluate(() => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    const span = (ln) => { const p = ln.geometry.attributes.position; return { ax: p.getX(0), ay: p.getY(0), az: p.getZ(0), bx: p.getX(1), by: p.getY(1), bz: p.getZ(1) }; };
    const run = (machine) => {
      v.setMachine(machine);
      v.fitAll();
      const L = v._gridLabels;
      return {
        xp: { x: L.xp.position.x, y: L.xp.position.y },
        xn: { x: L.xn.position.x, y: L.xn.position.y },
        yp: { x: L.yp.position.x, y: L.yp.position.y },
        yn: { x: L.yn.position.x, y: L.yn.position.y },
        lx: span(v._axisLineX), ly: span(v._axisLineY), lz: span(v._axisLineZ),
      };
    };
    const base = { show: true, z: 120, workOrigin: { x: 0, y: 0, z: 0 } };
    return {
      pos:  run({ ...base, x: 300, y: 300 }),    // standard travel
      negX: run({ ...base, x: -300, y: 300 }),   // homes the other way on X — labels must NOT flip
      negY: run({ ...base, x: 300, y: -300 }),   // homes the other way on Y — labels must NOT flip
      nonSquare: run({ ...base, x: 600, y: 300 }), // shorter axis must NOT overshoot (the green-line-outward bug)
    };
  });

  // Envelope-centre for each config (workOrigin 0): gCx = travelX/2, gCy = travelY/2.
  const centre = { pos: { gCx: 150, gCy: 150 }, negX: { gCx: -150, gCy: 150 }, negY: { gCx: 150, gCy: -150 } };
  for (const k of ['pos', 'negX', 'negY']) {
    // Signs are FIXED: +X always at the +scene (greater-x) end, +Y at the +scene (greater-y) end.
    expect(probe[k].xp.x, `${k}: +X at the +scene end`).toBeGreaterThan(probe[k].xn.x);
    expect(probe[k].yp.y, `${k}: +Y at the +scene end`).toBeGreaterThan(probe[k].yn.y);
    // Labels sit at the envelope-edge CENTRES: X labels share the centre-Y line, Y labels share the centre-X line.
    expect(probe[k].xp.y, `${k}: +X at centre-Y`).toBeCloseTo(centre[k].gCy, 3);
    expect(probe[k].xn.y, `${k}: -X at centre-Y`).toBeCloseTo(centre[k].gCy, 3);
    expect(probe[k].yp.x, `${k}: +Y at centre-X`).toBeCloseTo(centre[k].gCx, 3);
    expect(probe[k].yn.x, `${k}: -Y at centre-X`).toBeCloseTo(centre[k].gCx, 3);
  }

  // Each axis LINE spans only its own extent — no overshoot on the shorter axis (the green-line-outward bug) —
  // and the blue Z line spans the envelope height on the origin column.
  const ns = probe.nonSquare;   // 600 × 300 × 120, workOrigin 0 → gSpan = 600
  expect((ns.lx.bx - ns.lx.ax) / 2, 'X line half-span = |travelX|/2').toBeCloseTo(300, 3);
  expect((ns.ly.by - ns.ly.ay) / 2, 'Y line half-span = |travelY|/2, NOT gSpan/2 (=300)').toBeCloseTo(150, 3);
  expect(ns.lz.bz - ns.lz.az, 'Z line spans |travelZ|').toBeCloseTo(120, 3);
  expect(Math.abs(ns.lx.ay), 'X line rides y=0').toBeLessThan(1e-6);
  expect(Math.abs(ns.ly.ax), 'Y line rides x=0').toBeLessThan(1e-6);
  expect(Math.abs(ns.lz.ax) + Math.abs(ns.lz.ay), 'Z line on the origin column (x=0,y=0)').toBeLessThan(1e-6);
});
