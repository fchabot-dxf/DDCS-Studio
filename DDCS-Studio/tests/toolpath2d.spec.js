import { test, expect } from '@playwright/test';

// The shared 2D toolpath preview (viz/toolpath2d.js), extracted from the Blocks tab so Studio main + the
// wizards can show the same 2D view + Play. Guards the segment parser (the reusable core).
test('gcodeToSegments: types moves, chains positions, ignores comments/blank', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const segs = await page.evaluate(async () => {
    const { gcodeToSegments } = await import('/viz/toolpath2d.js');
    return gcodeToSegments([
      '( header )',
      'G0 X0 Y0',          // rapid to origin (no prior point → 0,0→0,0, still typed)
      'G1 X10 Y0 F100',    // feed
      'G1 X10 Y10',        // feed
      'G31 Z-5 F50',       // probe (no X/Y change → not a segment)
      'G0 X0 Y10',         // rapid
      '',                  // blank
    ].join('\n'));
  });
  // segments are emitted for lines that move in X/Y; G31 Z-only adds none
  expect(segs.map((s) => s.type)).toEqual(['rapid', 'feed', 'feed', 'rapid']);
  expect(segs[1]).toMatchObject({ x1: 0, y1: 0, x2: 10, y2: 0 });   // feed picks up from the rapid's end
  expect(segs[2]).toMatchObject({ x1: 10, y1: 0, x2: 10, y2: 10 });
  expect(segs[3]).toMatchObject({ x1: 10, y1: 10, x2: 0, y2: 10 }); // rapid after the (Z-only) probe keeps XY
});
