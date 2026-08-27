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

test('canvasWidgets registry: rect + radial gestures place + drag byte-identically to the hand-rolled drill math', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { buildCanvasWidgets } = await import('/viz/canvasWidgets.js');
    const out = {};
    const mk = (decls) => { const cap = {}; const w = buildCanvasWidgets(decls, (m) => Object.assign(cap, m)); return { ...w, cap }; };

    // rect — grid pitch (cols=3, rows=2, dx=20, dy=15): handle at anchor+extents; a drag divides by (cols-1)/(rows-1).
    const grid = mk([{ type: 'rect', id: 'size', field: 'd_dx', fieldH: 'd_dy', ax: 0, ay: 0, ex: 40, ey: 15, sx: 2, sy: 1, editMin: 0, label: 'dx', value: 20 }]);
    out.gridPlace = (() => { const h = grid.handles[0]; return { x: h.x, y: h.y, value: h.value }; })();
    grid.onDrag('size', { x: 60, y: 30 }); out.gridDrag = { ...grid.cap };              // d_dx=60/2=30, d_dy=30/1=30

    // single-column grid: divisor sx=0 leaves that axis untouched (signed pitch, no min — drag down for a -Y grid).
    const gridCol = mk([{ type: 'rect', id: 'size', field: 'd_dx', fieldH: 'd_dy', ax: 0, ay: 0, ex: 0, ey: 10, sx: 0, sy: 1, label: 'dx' }]);
    gridCol.onDrag('size', { x: 99, y: 25 }); out.gridColDrag = { ...gridCol.cap };      // only d_dy=25

    // rect — literal W/H (divisor 1, min 1) + click-to-edit clamp.
    const rect = mk([{ type: 'rect', id: 'size', field: 'd_w', fieldH: 'd_h', ax: 10, ay: 5, ex: 100, ey: 80, sx: 1, sy: 1, minw: 1, minh: 1, editMin: 1, label: 'W', value: 100 }]);
    out.rectPlace = (() => { const h = rect.handles[0]; return { x: h.x, y: h.y, value: h.value }; })();
    rect.onDrag('size', { x: 5, y: 90 }); out.rectDrag = { ...rect.cap };                // d_w=max(1,-5)=1, d_h=max(1,85)=85
    rect.onEdit('size', -3); out.rectEditClamp = rect.cap.d_w;                           // max(1,-3)=1

    // radial — circle ring (r=25 → Ø50, a=0, rScale=2): drag sets angle (atan2) + Ø (2·distance).
    const circ = mk([{ type: 'radial', id: 'ring', field: 'd_dia', fieldA: 'd_startAngle', cx: 0, cy: 0, r: 25, a: 0, rScale: 2, editMin: 0, label: 'Ø', value: 50 }]);
    out.circPlace = (() => { const h = circ.handles[0]; return { x: h.x, y: h.y, value: h.value }; })();
    circ.onDrag('ring', { x: 0, y: 30 }); out.circDrag = { ...circ.cap };                // d_dia=2·30=60, d_startAngle=90

    // radial — line end (n=3, s=20 → r=40, rScale=1/2): drag sets angle + pitch (distance/(n-1)).
    const line = mk([{ type: 'radial', id: 'end', field: 'd_spacing', fieldA: 'd_angle', cx: 0, cy: 0, r: 40, a: 0, rScale: 0.5, minR: 0, label: 'pitch', value: 20 }]);
    line.onDrag('end', { x: 0, y: 40 }); out.lineDrag = { ...line.cap };                 // d_spacing=40/2=20, d_angle=90

    // single-point line (rScale null) → pure rotate: angle only, no pitch.
    const line1 = mk([{ type: 'radial', id: 'end', field: 'd_spacing', fieldA: 'd_angle', cx: 0, cy: 0, r: 0, a: 0, rScale: null, label: 'pitch' }]);
    line1.onDrag('end', { x: 3, y: 3 }); out.line1Drag = { ...line1.cap };               // d_angle=45 only
    return out;
  });
  expect(r.gridPlace, 'grid size handle sits at anchor + extents, showing its pitch').toEqual({ x: 40, y: 15, value: 20 });
  expect(r.gridDrag, 'grid drag → pitch = corner offset / (count-1)').toEqual({ d_dx: 30, d_dy: 30 });
  expect(r.gridColDrag, 'a zero divisor skips its axis').toEqual({ d_dy: 25 });
  expect(r.rectPlace).toEqual({ x: 110, y: 85, value: 100 });
  expect(r.rectDrag, 'rect drag → W/H clamped to min 1').toEqual({ d_w: 1, d_h: 85 });
  expect(r.rectEditClamp, 'click-to-edit honours editMin').toBe(1);
  expect(r.circPlace, 'ring handle on the circle at the start angle').toEqual({ x: 25, y: 0, value: 50 });
  expect(r.circDrag.d_dia, 'radial drag → Ø = 2 · distance').toBe(60);
  expect(r.circDrag.d_startAngle, 'radial drag → start angle').toBeCloseTo(90, 6);
  expect(r.lineDrag.d_spacing, 'line drag → pitch = distance / (n-1)').toBe(20);
  expect(r.lineDrag.d_angle).toBeCloseTo(90, 6);
  expect(Object.keys(r.line1Drag), 'pure-rotate radial sets only the angle').toEqual(['d_angle']);
  expect(r.line1Drag.d_angle).toBeCloseTo(45, 6);
});

test('canvasWidgets registry: pocket gesture params (ellipse half-extent rect + radius-only radial) match the old formulas', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { buildCanvasWidgets } = await import('/viz/canvasWidgets.js');
    const out = {};
    const mk = (decls) => { const cap = {}; const w = buildCanvasWidgets(decls, (m) => Object.assign(cap, m)); return { ...w, cap }; };

    // ELLIPSE size = a rect whose handle rides the half-extent (rx,ry); divisor 0.5 → full W/H = 2·offset (min 1).
    const ell = mk([{ type: 'rect', id: 'size', field: 'p_w', fieldH: 'p_h', ax: 10, ay: 20, ex: 40, ey: 30, sx: 0.5, sy: 0.5, minw: 1, minh: 1, label: 'W × H' }]);
    out.ellPlace = (() => { const h = ell.handles[0]; return { x: h.x, y: h.y, value: h.value }; })();   // 10+40, 20+30
    ell.onDrag('size', { x: 40, y: 60 }); out.ellDrag = { ...ell.cap };                  // p_w=2·30=60, p_h=2·40=80
    const ell2 = mk([{ type: 'rect', id: 'size', field: 'p_w', fieldH: 'p_h', ax: 10, ay: 20, ex: 40, ey: 30, sx: 0.5, sy: 0.5, minw: 1, minh: 1, label: 'W × H' }]);
    ell2.onDrag('size', { x: 9, y: 19 }); out.ellClamp = { ...ell2.cap };                // both clamp to 1

    // CIRCLE/POLYGON size = a radius-only radial (no angle field): Ø = 2·distance (min 1); never writes an angle.
    const circ = mk([{ type: 'radial', id: 'size', field: 'p_dia', cx: 0, cy: 0, r: 25, a: 0, rScale: 2, minR: 1, label: 'Ø' }]);
    out.circPlace = (() => { const h = circ.handles[0]; return { x: h.x, y: h.y, value: h.value == null ? 'none' : h.value }; })();
    circ.onDrag('size', { x: 0, y: 30 }); out.circDrag = { ...circ.cap };                // p_dia=2·30=60, no angle key
    const circ2 = mk([{ type: 'radial', id: 'size', field: 'p_dia', cx: 0, cy: 0, r: 25, a: 0, rScale: 2, minR: 1, label: 'Ø' }]);
    circ2.onDrag('size', { x: 0.1, y: 0 }); out.circClamp = circ2.cap.p_dia;             // max(1, 0.2) = 1
    return out;
  });
  expect(r.ellPlace, 'ellipse handle at the half-extent corner, no value label').toEqual({ x: 50, y: 50, value: undefined });
  expect(r.ellDrag, 'ellipse drag → full W/H = 2 · offset').toEqual({ p_w: 60, p_h: 80 });
  expect(r.ellClamp, 'ellipse W/H clamp to 1').toEqual({ p_w: 1, p_h: 1 });
  expect(r.circPlace, 'circle handle on the +X radius, valueless (drag-only)').toEqual({ x: 25, y: 0, value: 'none' });
  expect(Object.keys(r.circDrag), 'radius-only radial writes ONLY the Ø field — never an angle').toEqual(['p_dia']);
  expect(r.circDrag.p_dia, 'Ø = 2 · distance').toBe(60);
  expect(r.circClamp, 'Ø clamps to 1').toBe(1);
});

test('canvasWidgets registry: projLength gesture (slot width) matches the perpendicular-projection formula', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { buildCanvasWidgets } = await import('/viz/canvasWidgets.js');
    const out = {};
    const mk = (decls) => { const cap = {}; const w = buildCanvasWidgets(decls, (m) => Object.assign(cap, m)); return { ...w, cap }; };

    // Horizontal slot A(0,0)→B(60,0): centreline normal n̂=(0,1), midpoint (30,0), tool Ø 6, half-width 5.
    const horiz = () => mk([{ type: 'projLength', id: 'width', field: 'sl_width', cx: 30, cy: 0, nx: 0, ny: 1, off: 5, scale: 2, min: 6, label: 'width' }]);
    const h0 = horiz();
    out.place = (() => { const h = h0.handles[0]; return { x: h.x, y: h.y, value: h.value }; })();   // midpoint + n̂·hw = (30,5)
    h0.onDrag('width', { x: 35, y: 9 }); out.wide = h0.cap.sl_width;                     // proj=9 → 2·9=18
    const h1 = horiz(); h1.onDrag('width', { x: 30, y: 2 }); out.clamp = h1.cap.sl_width; // proj=2 → 2·2=4 → clamp to tool Ø 6
    const h2 = horiz(); h2.onDrag('width', { x: 30, y: -7 }); out.symmetric = h2.cap.sl_width; // proj=-7 → |·|·2 = 14

    // Tilted slot A(0,0)→B(0,40): n̂=(-1,0) — proves the projection follows the slot AXIS, not a fixed screen direction.
    const tilt = mk([{ type: 'projLength', id: 'width', field: 'sl_width', cx: 0, cy: 20, nx: -1, ny: 0, off: 4, scale: 2, min: 6, label: 'width' }]);
    out.tiltPlace = (() => { const h = tilt.handles[0]; return { x: h.x, y: h.y }; })();  // (0,20) + (-1,0)·4 = (-4,20)
    tilt.onDrag('width', { x: -9, y: 25 }); out.tiltWide = tilt.cap.sl_width;             // proj=(-9)(-1)=9 → 18
    return out;
  });
  expect(r.place, 'width handle rides the centreline normal at the half-width, drag-only (no value)').toEqual({ x: 30, y: 5, value: undefined });
  expect(r.wide, 'width = 2 · perpendicular distance').toBe(18);
  expect(r.clamp, 'width clamps to the tool Ø').toBe(6);
  expect(r.symmetric, 'either side of the centreline → the same positive width').toBe(14);
  expect(r.tiltPlace, 'handle follows the tilted slot normal').toEqual({ x: -4, y: 20 });
  expect(r.tiltWide, 'projection is taken along the slot axis').toBe(18);
});

test('drill wizard renders its handles from the registry (point + radial)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  // Switch to the bolt-circle pattern so the radial 'ring' handle (with its Ø value label) renders.
  await page.evaluate(() => { const e = document.getElementById('d_pattern'); if (e) e.value = 'circle'; window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const cont = document.getElementById('drillLayoutCanvas');
    if (!cont) return { handles: -1 };
    const labels = [...cont.querySelectorAll('.fc-handle-label')].map((t) => t.textContent);
    return {
      handles: cont.querySelectorAll('.fc-handle').length,
      moves: cont.querySelectorAll('.fc-handle-move').length,
      diamonds: cont.querySelectorAll('polygon.fc-handle').length,
      hasDia: labels.some((t) => /Ø/.test(t)),
    };
  });
  // t2327 (BACKLOG #33) — the circle ring split into TWO handles (hole #1's own angle-only rotate handle, plus
  // the diamond-shaped Ø handle) so a drag can no longer fuse radius+angle into one move — origin(point) +
  // rot(radial, angle-only) + ring(radial, diamond) = 3.
  expect(r.handles, 'origin (point) + rot (angle-only) + ring (diamond Ø) all render').toBe(3);
  expect(r.moves, 'origin is a move/snap handle').toBe(1);
  expect(r.diamonds, 'the Ø handle renders as a diamond, not a circle').toBe(1);
  expect(r.hasDia, 'the diamond Ø handle shows its value label').toBe(true);
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
