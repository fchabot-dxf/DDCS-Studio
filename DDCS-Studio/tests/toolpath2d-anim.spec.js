import { test, expect } from '@playwright/test';

// 2D PROBE-MOVEMENT animation (advisor #14): the 2D playback head rides the LIVE sim position (the same engine
// onPositionChange the 3D tool uses), so the probe/tool travels the 2D path in sync with the 3D — and through the #13
// ptx/pty pin transform so it stays ON a WCS-pinned stock. This locks the head logic: it follows the live position
// (not the coarse nearest segment node) and applies the stock pin.
test.use({ viewport: { width: 1280, height: 900 } });

test('2D head rides the LIVE sim position (in sync with the 3D) and on the pinned stock', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99999';
    document.body.appendChild(cv);
    const t2 = createToolpath2d(cv, {});
    t2.setMachine({ show: true, x: 300, y: 300, z: 100, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [{ x: 40, y: -50, z: 0 }] } });
    t2.setStock({ x: 100, y: 80, z: 20, shape: 'pocket', show: true, datum: 'nnp', pin: 'g54' });
    t2.setSegments([{ x1: 0, y1: 0, x2: 100, y2: 0, z1: -1, z2: -1, type: 'probe', feed: 50 }]);   // one long probe segment
    t2.seek(0);          // enter playback at the start node (program 0,0)
    const v = cv.__t2view;
    t2.setToolPosition({ x: 50, y: 0 });   // LIVE pos mid-segment (program 50,0) — the engine onPositionChange signal
    const head = cv.__t2head;
    cv.remove();
    // expected screen X: live 50 + pin 40 = 90 ; the (wrong) node-only fallback would be 0 + 40 = 40
    return { headSx: head.sx, live: head.live, liveSx: v.ox + (50 + 40) * v.scale, nodeSx: v.ox + (0 + 40) * v.scale, headSy: head.sy, expectSy: v.oy - (0 + (-50)) * v.scale };
  });

  expect(r.live, 'the head is driven by the live tool position').toBe(true);
  expect(r.headSx, 'head rides the LIVE pos (50) + the stock pin (40) → x=90, not the node x=0').toBeCloseTo(r.liveSx, 1);
  expect(Math.abs(r.headSx - r.nodeSx), 'and NOT stuck at the segment node (0+pin)').toBeGreaterThan(20);
  expect(r.headSy, 'Y rides the pin too (0 + pin −50)').toBeCloseTo(r.expectSy, 1);
});
