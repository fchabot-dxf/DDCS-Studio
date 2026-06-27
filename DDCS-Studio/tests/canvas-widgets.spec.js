import { test, expect } from '@playwright/test';

/**
 * The reusable CANVAS-WIDGET registry (web/viz/canvasWidgets.js) — the canvas analogue of formWidgets. A view DECLARES
 * its drag handles by gesture type (point / length / scaleX / shear) and the registry owns the place + drag math, so the
 * per-wizard hand-rolled onDrag goes away. Text is the first consumer (pos/height reuse point/length; width=scaleX,
 * slant=shear). Reused across milling wizards (Stage 2) + declarable by end users in the wizard maker (Stage 3).
 */

test('canvasWidgets registry: each gesture places its handle + maps a drag to the right field', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { buildCanvasWidgets } = await import('/viz/canvasWidgets.js');
    const captured = {};
    // text-like geometry: origin (0,0), height 12, width 1, slant 0, advance lineW 50.
    const { handles, onDrag, onEdit } = buildCanvasWidgets([
      { type: 'point', fx: 'tx_x', fy: 'tx_y', x: 0, y: 0, label: 'pos' },
      { type: 'length', field: 'tx_height', ax: 0, ay: 0, axis: 'y', value: 12, min: 2, label: 'height' },
      { type: 'scaleX', field: 'tx_width', ax: 0, edgeX: 50, ay: 0, value: 1, min: 0.2, label: 'width' },
      { type: 'shear', field: 'tx_slant', ax: 50, ay: 0, h: 12, value: 0, label: 'slant' },
    ], (m) => Object.assign(captured, m));
    const at = (k) => handles.find((h) => h.id.startsWith(k));
    onDrag('point:tx_x', { x: 5, y: 7 }); const pt = { ...captured };
    onDrag('length:tx_height', { x: 9, y: 20 }); const len = captured.tx_height;
    onDrag('scaleX:tx_width', { x: 100, y: 0 }); const sx = captured.tx_width;       // 1 · (100-0)/(50-0) = 2
    onDrag('shear:tx_slant', { x: 62, y: 12 }); const sh = captured.tx_slant;        // atan2(62-50, 12) = 45°
    onEdit('scaleX:tx_width', 1.5); const ed = captured.tx_width;
    return {
      count: handles.length,
      posHandle: at('point') && { x: at('point').x, y: at('point').y, kind: at('point').kind },
      heightHandle: at('length') && { x: at('length').x, y: at('length').y, value: at('length').value },
      widthHandle: at('scaleX') && { x: at('scaleX').x, value: at('scaleX').value },
      slantHandle: at('shear') && { x: at('shear').x, y: at('shear').y },
      pt, len, sx, sh, ed,
    };
  });
  expect(r.count, 'four declared handles').toBe(4);
  expect(r.posHandle, 'pos = a move handle at the origin').toEqual({ x: 0, y: 0, kind: 'move' });
  expect(r.heightHandle, 'height handle at (0,12) showing its value').toEqual({ x: 0, y: 12, value: 12 });
  expect(r.widthHandle, 'width handle at the right edge (50,_)').toEqual({ x: 50, value: 1 });
  expect(r.slantHandle, 'slant handle at the (upright) top-right').toEqual({ x: 50, y: 12 });
  expect(r.pt, 'point drag → both position fields').toEqual({ tx_x: 5, tx_y: 7 });
  expect(r.len, 'length drag → the axis distance').toBe(20);
  expect(r.sx, 'scaleX drag → proportional scale factor').toBeCloseTo(2, 5);
  expect(r.sh, 'shear drag → the skew angle in degrees').toBeCloseTo(45, 4);
  expect(r.ed, 'click-to-edit writes the field directly').toBe(1.5);
});

test('text wizard renders its four canvas handles from the registry', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('text'));
  await page.waitForSelector('#wiz_text', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForTimeout(200);
  const handleCount = await page.evaluate(() => {
    const cont = document.getElementById('textLayoutCanvas');
    return cont ? cont.querySelectorAll('.fc-handle').length : -1;
  });
  expect(handleCount, 'pos + height + width + slant handles all render on the canvas').toBe(4);
});
