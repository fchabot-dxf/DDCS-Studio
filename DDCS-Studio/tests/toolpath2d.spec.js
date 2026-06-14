import { test, expect } from '@playwright/test';

// The shared 2D toolpath preview (viz/toolpath2d.js), used by Blocks + Studio main + the wizards. Its route
// now comes from the EXECUTION ENGINE's trace (engine/trace.js), not a regex parser — so a #var coordinate
// (`G1 Z#5`), which the old gcodeToSegments dropped, resolves and draws. This guards that wiring.
test('2D preview sources its route from the engine trace (resolves #vars)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const cv = document.createElement('canvas');
    cv.style.width = '240px'; cv.style.height = '240px'; document.body.appendChild(cv);
    const t2 = createToolpath2d(cv);
    // a #var coordinate (the old regex couldn't resolve `Z#5`) + a couple of plain feeds
    t2.setGcode(['G90', '#5=-3.5', 'G1 Z#5 F100', 'G1 X10 Y0', 'G1 X10 Y10', 'M30'].join('\n'));
    const varCount = t2.count;
    t2.setGcode(['G90', 'G0 X0 Y0', 'G1 X10 Y0 F100', 'G1 X10 Y10', 'M30'].join('\n'));
    const plainCount = t2.count;
    // seek drives the trail head from outside (engine progress) without throwing
    t2.seek(1); const playingAfterSeek = t2.playing;
    return { varCount, plainCount, playingAfterSeek };
  });
  expect(r.varCount, 'the #var program produced a drawable route (engine-resolved)').toBeGreaterThan(0);
  expect(r.plainCount, 'a plain program draws too').toBeGreaterThan(0);
  expect(r.playingAfterSeek).toBe(true);
});
