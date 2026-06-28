import { test, expect } from '@playwright/test';

// 2D anchor-frame fix (turn 42): the 2D toolpath mirrors the 3D's _anchorToStart. An INCREMENTAL probe is start-relative
// → its origin-relative trace must EMANATE from the operator START marker (the spindle pos), not the stock's G54 pin.
// #13 pinned EVERYTHING to the stock unconditionally → an incremental path wrongly began on G54. Now:
//   • anchored (incremental, machine=null/local) → path + head ride the start (they coincide with the start marker)
//   • absolute (#13, pinned machine)            → path still rides the stock WCS pin (no regression)
// Real data: the actual CornerWizard macro (incremental, #vars), not a hand-typed literal.
test.use({ viewport: { width: 1280, height: 900 } });

const START = { x: -25.7, y: 77.4, z: 5 };
const STOCK = { x: 100, y: 80, z: 20, shape: 'pocket', show: true, datum: 'nnp', pin: 'g54' };

test('ANCHORED (incremental corner probe): path origin + live head coincide with the START marker', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async ({ START, STOCK }) => {
    const { CornerWizard } = await import('/wizards/cornerWizard.js');
    const code = new CornerWizard().generate({ corner: 'fl', stockX: 100, stockY: 80, stockZ: 20, probeZ: true });
    const { traceToolpath } = await import('/engine/trace.js');
    const parsed = traceToolpath(code, { stock: STOCK, start: START });
    const segs = parsed.segments || [];
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99999';
    document.body.appendChild(cv);
    const t2 = createToolpath2d(cv, {});
    t2.setMachine(null);          // anchored → the panel sends machine=null (LOCAL scene, pin=0)
    t2.setStock(STOCK);
    t2.setAnchor(true);
    t2.setStart(START);
    t2.setSegments(segs);
    t2.seek(1); t2.setToolPosition({ x: segs[0].x2, y: segs[0].y2 }); t2.fit();
    const v = cv.__t2view, head = cv.__t2head, first = segs[0];
    const pathOrigin = { sx: v.ox + (first.x1 + START.x) * v.scale, sy: v.oy - (first.y1 + START.y) * v.scale };
    const startMarker = { sx: v.ox + START.x * v.scale, sy: v.oy - START.y * v.scale };
    cv.remove();
    return { incremental: !(parsed.stats && parsed.stats.absolute), firstNode: { x: first.x1, y: first.y1 }, pathOrigin, startMarker, head };
  }, { START, STOCK });

  expect(r.incremental, 'the corner probe is incremental').toBe(true);
  expect(r.firstNode, 'the trace is origin-relative (first node ≈ 0,0)').toEqual({ x: 0, y: 0 });
  // the path origin is drawn AT the start marker (not at part-zero / the stock pin)
  expect(Math.abs(r.pathOrigin.sx - r.startMarker.sx), 'path origin X = start marker X').toBeLessThan(1);
  expect(Math.abs(r.pathOrigin.sy - r.startMarker.sy), 'path origin Y = start marker Y').toBeLessThan(1);
  // the LIVE head (engine pos, origin-relative) rides the start too — in sync with the 3D
  expect(r.head.live).toBe(true);
  expect(Math.abs(r.head.sx - r.startMarker.sx), 'head X rides the start').toBeLessThan(1);
  expect(Math.abs(r.head.sy - r.startMarker.sy), 'head Y rides the start').toBeLessThan(1);
});

test('ABSOLUTE (#13 regression): the path still rides the stock WCS pin', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99999';
    document.body.appendChild(cv);
    const t2 = createToolpath2d(cv, {});
    // G54 = (40,-50); workOrigin stale 0 → pin = (40,-50)
    t2.setMachine({ show: true, x: 300, y: 300, z: 100, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [{ x: 40, y: -50, z: 0 }] } });
    t2.setStock({ x: 100, y: 80, z: 20, shape: 'pocket', show: true, datum: 'nnp', pin: 'g54' });
    t2.setAnchor(false);   // absolute / mill
    t2.setSegments([{ x1: 0, y1: 40, x2: 60, y2: 40, z1: -1, z2: -1, type: 'feed' }]);   // node at program (60,40)
    t2.fit();
    const v = cv.__t2view;
    const sx = v.ox + (60 + 40) * v.scale, sy = v.oy - (40 + (-50)) * v.scale;
    cv.dispatchEvent(new PointerEvent('pointermove', { clientX: sx, clientY: sy, bubbles: true }));
    const cur = cv.__t2cursor;
    cv.remove();
    return { cur };
  });
  expect(r.cur && r.cur.snapped, 'snapped to the pin-riding node').toBe(true);
  expect(r.cur.x, 'node X = 60 + pin.x(40)').toBeCloseTo(100, 0);
  expect(r.cur.y, 'node Y = 40 + pin.y(-50)').toBeCloseTo(-10, 0);
});
