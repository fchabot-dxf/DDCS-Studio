import { test, expect } from '@playwright/test';

// Dragging a wizard's POSITION ('move') handle in the 2D layout snaps onto stock anchors: any of the path's 9 bbox
// anchors (corners / edge mids / centre), or the handle itself, can be the point that lands on a stock anchor (or
// part-zero). You still drag only the one position handle. Verified on the FeatureCanvas snap math directly.
test.use({ viewport: { width: 1280, height: 900 } });

test('position handle snaps any path anchor onto a stock anchor', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const m = await import('/viz/featureCanvas.js');
    const fc = new m.FeatureCanvas();
    fc._tf = { scale: 1, cx: 0, cy: 0, cxw: 0, cyw: 0 };               // scale 1 → snap tolerance = 10 world units
    fc.spec = { items: [{ kind: 'rect', x: 0, y: 0, w: 40, h: 20 }] }; // path footprint: 0..40 × 0..20
    const handle = { x: 0, y: 0, kind: 'move' };                       // the position handle, at the path's min corner
    fc.active = { kind: 'move', snapOffsets: fc._snapOffsets(handle) };
    fc._attachPts = [{ x: 100, y: 80, code: 'pp' }, { x: 10, y: 10, code: 'nn' }];   // two stock anchors (off the origin)
    // Drag near (62,62): the path's TOP-RIGHT anchor (40,20) would land on stock 'pp' (100,80) when the handle is at
    // (60,60) — within tolerance, so it snaps there.
    const near = fc._snapToAnchor({ x: 62, y: 62 });
    // Drag near (12,8): the handle itself (offset 0) lands on stock 'nn' (10,10) → snaps to (10,10).
    const corner = fc._snapToAnchor({ x: 12, y: 8 });
    const far = fc._snapToAnchor({ x: 200, y: 200 });   // nothing close → free drag
    return {
      nOffsets: fc.active.snapOffsets.length,
      near: near && { x: near.x, y: near.y, code: near.target.code },
      corner: corner && { x: corner.x, y: corner.y, code: corner.target.code },
      far,
    };
  });
  expect(r.nOffsets, 'handle point + 9 path-bbox anchors').toBe(10);
  expect(r.near, 'top-right path anchor snaps onto stock pp').toMatchObject({ x: 60, y: 60, code: 'pp' });
  expect(r.corner, 'handle point snaps onto stock nn').toMatchObject({ x: 10, y: 10, code: 'nn' });
  expect(r.far, 'far from any anchor → no snap').toBeNull();
});
