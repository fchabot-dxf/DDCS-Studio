import { test, expect } from '@playwright/test';

/**
 * Coordinate-list positioner (widget:'coord-list') — the first LIST-valued instance of the parametric-canvas atom:
 * a GROUP of XY points (draggable markers on the shared FeatureCanvas) + a shared Z, with add/delete. State =
 * { points:[{x,y}], z }; the binding commits the whole list (type:'list'). Proves "yes, you can author an arbitrary
 * coordinate positioner with that atom." Locks: renders a marker per point, ＋Point adds, ✕ removes, Z is shared,
 * and read() returns the list + z.
 */
test.use({ viewport: { width: 1000, height: 900 } });

test('coord-list: renders point markers; add/remove/shared-Z; read() returns the list', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const FW = await import('/ui/formWidgets.js');
    const host = document.createElement('div'); host.style.cssText = 'width:420px;'; document.body.appendChild(host);
    const binding = { param: 'pts', widget: 'coord-list', type: 'list',
      default: { points: [{ x: 20, y: 20 }, { x: 90, y: 50 }], z: -5 },
      widgetConfig: { bounds: { w: 120, h: 90, ox: 0, oy: 0 }, height: 160 } };
    const readers = FW.renderOpForm(host, [binding]);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));   // let FeatureCanvas draw

    const markers0 = host.querySelectorAll('.fc-handle-move').length;
    host.querySelector('.cl-add').click();                                 // ＋ Point → 3
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const markers1 = host.querySelectorAll('.fc-handle-move').length;
    const z = host.querySelector('.cl-z'); z.value = '-8'; z.dispatchEvent(new Event('input', { bubbles: true }));
    const read1 = readers[0]();

    host.querySelectorAll('.cl-del')[0].click();                            // ✕ first → 2
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const read2 = readers[0]();

    return { markers0, markers1, read1, read2, svg: host.querySelectorAll('.cl-canvas svg').length };
  });

  expect(r.svg, 'FeatureCanvas mounted').toBe(1);
  expect(r.markers0, 'a draggable marker per point').toBe(2);
  expect(r.markers1, '＋ Point added a marker').toBe(3);
  expect(r.read1.pts.points).toHaveLength(3);
  expect(r.read1.pts.z, 'shared Z committed').toBe(-8);
  expect(r.read2.pts.points, '✕ removed a point').toHaveLength(2);
  expect(typeof r.read1.pts.points[0].x).toBe('number');
});
