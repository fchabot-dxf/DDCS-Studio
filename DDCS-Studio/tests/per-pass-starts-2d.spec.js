import { test, expect } from '@playwright/test';

// INC1: the 2D canvas shows ALL per-pass operator starts (①②…) as numbered, draggable cyan lozenges — parity with the
// 3D markers (a multi-pass probe like a boss/middle probe-both has one start per pass). Before this it drew only pass 0.
test.use({ viewport: { width: 1280, height: 900 } });

test('2D draws ALL per-pass start markers (numbered) and each is draggable', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const drags = [];
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99999';
    document.body.appendChild(cv);
    const t2 = createToolpath2d(cv, { onStartDrag: (pos, pass) => drags.push({ pass, x: +pos.x.toFixed(1), y: +pos.y.toFixed(1) }) });
    t2.setStarts([{ x: 0, y: 0, z: 0 }, { x: 40, y: 30, z: 0 }]);   // two per-pass starts (①②)
    t2.setSegments([]); t2.fit();
    const marks = cv.__t2starts;
    // drag the 2nd marker (index 1) +50px to the right
    const r0 = cv.getBoundingClientRect(), m1 = marks.find((m) => m.i === 1);
    const ev = (type, sx, sy) => cv.dispatchEvent(new PointerEvent(type, { clientX: r0.left + sx, clientY: r0.top + sy, bubbles: true, pointerId: 1 }));
    ev('pointerdown', m1.sx, m1.sy); ev('pointermove', m1.sx + 50, m1.sy); ev('pointerup', m1.sx + 50, m1.sy);
    cv.remove();
    return { count: marks.length, ids: marks.map((m) => m.i), drags };
  });
  expect(r.count, 'two per-pass start markers drawn').toBe(2);
  expect(r.ids, 'indices 0,1 → rendered as ①②').toEqual([0, 1]);
  expect(r.drags.length, 'dragging fired onStartDrag').toBeGreaterThan(0);
  expect(r.drags[r.drags.length - 1].pass, 'the 2nd marker (pass 1) was the one dragged').toBe(1);
  expect(r.drags[r.drags.length - 1].x, 'the 2nd start moved +X').toBeGreaterThan(40);
});

test('a real boss probe-both macro has >1 pass (so the panel feeds both markers)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const code = new MiddleWizard().generate({ featureType: 'boss', twoAxis: true, approach: 'manual', stockX: 100, stockY: 80, stockZ: 20 });
    const parsed = traceToolpath(code, { stock: { x: 100, y: 80, z: 20, shape: 'boss' } });
    return { passes: (parsed.stats && parsed.stats.passes) || 1 };
  });
  expect(r.passes, 'a boss probe-both is multi-pass → the 2D shows ① AND ②').toBeGreaterThan(1);
});
