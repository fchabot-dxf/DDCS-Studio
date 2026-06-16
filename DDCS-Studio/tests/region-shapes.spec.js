import { test, expect } from '@playwright/test';

// The Region (Shapes) block gains polygon + ellipse (on top of rect + circle); fills/walls are contour-based so
// the new shapes work wherever a region plugs in.
test('Region block produces polygon + ellipse contours', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { regionDesc } = await import('/wizards/ops/region.js');
    const poly = regionDesc({ shape: 'polygon', x: 0, y: 0, w: 40, sides: 6 });
    const ell = regionDesc({ shape: 'ellipse', x: 0, y: 0, w: 40, h: 20 });
    const rect = regionDesc({ shape: 'rect', x: 0, y: 0, w: 50, h: 30 });   // unchanged
    return {
      polyKind: poly.kind, polySides: poly.sides, polyVerts: poly.contour[0].length,
      ellKind: ell.kind, ellRx: ell.rx, ellRy: ell.ry, ellHasPts: ell.contour[0].length > 8,
      rectKind: rect.kind, rectVerts: rect.contour[0].length,
    };
  });
  expect(r.polyKind, 'polygon').toBe('polygon');
  expect(r.polySides, '6 sides').toBe(6);
  expect(r.polyVerts, '6 vertices').toBe(6);
  expect(r.ellKind, 'ellipse').toBe('ellipse');
  expect(r.ellRx, 'rx = w/2').toBe(20);
  expect(r.ellRy, 'ry = h/2').toBe(10);
  expect(r.ellHasPts, 'ellipse contour built').toBeTruthy();
  expect(r.rectKind, 'rect still works').toBe('rect');
  expect(r.rectVerts, 'rect = 4 corners').toBe(4);
});
