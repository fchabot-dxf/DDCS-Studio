import { test, expect } from '@playwright/test';

// 2D-canvas FRAME fix (Option A, advisor #13): the toolpath + start used to draw in the program/part frame (part-zero)
// while a WCS-pinned stock sat at its table offset → the toolpath floated off the stock by the WCS offset. Now the
// toolpath + start ride the SAME pin as the stock, so they sit ON it. Proven behaviourally via the snap: a toolpath
// node lands where program+pin is drawn (a mid-stock point that is NOT a stock corner), which only holds once the path
// rides the pin (before the fix the node was a whole WCS-offset away and nothing would snap there).
test.use({ viewport: { width: 1280, height: 900 } });

test('2D toolpath + start ride the stock WCS pin (Option A) — node is drawn ON a pinned stock', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99999';
    document.body.appendChild(cv);
    const t2 = createToolpath2d(cv, {});
    // G54 = (40, -50) in the table; workOrigin stale 0 → stock pin offset = (40, -50).
    t2.setMachine({ show: true, x: 300, y: 300, z: 100, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [{ x: 40, y: -50, z: 0 }] } });
    t2.setStock({ x: 100, y: 80, z: 20, shape: 'pocket', show: true, datum: 'nnp', pin: 'g54' });
    t2.setSegments([{ x1: 0, y1: 40, x2: 60, y2: 40, z1: -1, z2: -1, type: 'feed' }]);   // node at program (60,40)
    t2.fit();
    const v = cv.__t2view;
    // The node (60,40) must be DRAWN at program+pin = (100, -10) — mid-stock (stock spans X[40..140] Y[-50..30],
    // centre (90,-10)), so it's not a corner/centre and only a pin-riding path lands there.
    const sx = v.ox + (60 + 40) * v.scale, sy = v.oy - (40 + (-50)) * v.scale;
    cv.dispatchEvent(new PointerEvent('pointermove', { clientX: sx, clientY: sy, bubbles: true }));
    const cur = cv.__t2cursor;
    cv.remove();
    return { cur, pin: { x: 40, y: -50 } };
  });

  expect(r.cur, 'a snap fired at the drawn node position').toBeTruthy();
  expect(r.cur.snapped, 'snapped to the toolpath node (it is drawn there)').toBe(true);
  // the node rode the pin: program (60,40) → drawn/snapped at (100, -10) = program + the (40,-50) pin
  expect(r.cur.x, 'node X = 60 + pin.x(40)').toBeCloseTo(100, 0);
  expect(r.cur.y, 'node Y = 40 + pin.y(-50)').toBeCloseTo(-10, 0);
});
