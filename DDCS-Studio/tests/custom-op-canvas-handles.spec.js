import { test, expect } from '@playwright/test';

/**
 * Custom-op `form2d` panels get DRAG-TO-EDIT for free, derived from the param-block roles. `layoutSpecFromOp` reads
 * the op's grouped x/y (/w/h) bindings — which it already used to DRAW the point/rect — and now also builds a
 * draggable handle whose onDrag writes those param FIELDS (firing 'input' → userOpView.update() redraws). The seam
 * that makes the spatial-GUI decision real for users: an author declares x/y as number params + the Form+2D panel,
 * and the preview is drag-to-edit, with NO per-op code. Guard: a handle is built only if the param is a writable
 * field (so we never put a dead handle over a canvas-widget param that owns its value internally).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('a writable xy param group → a draggable point handle whose drag writes the param fields', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const PT = await import('/wizards/ops/panelTypes.js');
    const def = { bindings: [{ param: 'px', group: 'pt', role: 'x' }, { param: 'py', group: 'pt', role: 'y' }] };

    // (1) NOT writable yet (no rendered form) → still DRAWN, but NO handle (don't put a dead handle over it)
    const readOnly = PT.layoutSpecFromOp(def, { px: 50, py: 40 });

    // (2) render the form fields the way the number widget does (tagged data-param) → now writable
    const form = document.createElement('div'); form.id = 'wiz_user_form';
    const ix = document.createElement('input'); ix.dataset.param = 'px'; ix.value = '50';
    const iy = document.createElement('input'); iy.dataset.param = 'py'; iy.value = '40';
    form.append(ix, iy); document.body.appendChild(form);
    let fired = 0; ix.addEventListener('input', () => { fired++; }); iy.addEventListener('input', () => { fired++; });

    const spec = PT.layoutSpecFromOp(def, { px: 50, py: 40 });
    const h = (spec.handles || [])[0];
    spec.onDrag(h.id, { x: 100, y: 60 });          // drag the move handle to (100,60)
    const out = {
      roItems: readOnly.items.length, roHandles: readOnly.handles.length,
      items: spec.items.length, handles: spec.handles.length,
      hKind: h && h.kind, hx: h && h.x, hy: h && h.y,
      newX: Number(ix.value), newY: Number(iy.value), fired,
    };
    form.remove();
    return out;
  });

  // read-only when no field exists: drawn (1 point item) but no handle
  expect(r.roItems, 'the point is still drawn when not writable').toBe(1);
  expect(r.roHandles, 'no dead handle over a non-writable param').toBe(0);
  // writable: one move handle, at the param values
  expect(r.items).toBe(1);
  expect(r.handles, 'one draggable handle derived from the xy roles').toBe(1);
  expect(r.hKind).toBe('move');
  expect(r.hx).toBe(50); expect(r.hy).toBe(40);
  // dragging it writes the param fields and fires their input (→ update() would redraw)
  expect(r.newX, 'drag wrote the x param').toBe(100);
  expect(r.newY, 'drag wrote the y param').toBe(60);
  expect(r.fired, 'each written field fired input (drives update())').toBe(2);
});

test('a writable xywh group → a position + a size handle; size drag writes w/h from the origin', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const PT = await import('/wizards/ops/panelTypes.js');
    const def = { bindings: ['x', 'y', 'w', 'h'].map((role) => ({ param: 'r_' + role, group: 'rc', role })) };
    const form = document.createElement('div'); form.id = 'wiz_user_form';
    const fields = {};
    for (const role of ['x', 'y', 'w', 'h']) { const f = document.createElement('input'); f.dataset.param = 'r_' + role; f.value = ({ x: 10, y: 20, w: 60, h: 40 })[role]; form.append(f); fields[role] = f; }
    document.body.appendChild(form);

    const spec = PT.layoutSpecFromOp(def, { r_x: 10, r_y: 20, r_w: 60, r_h: 40 });
    const size = spec.handles.find((h) => /_size$/.test(h.id));
    spec.onDrag(size.id, { x: 100, y: 90 });        // drag the size handle (rect origin is 10,20) → w=90, h=70
    const out = { handles: spec.handles.length, kinds: spec.handles.map((h) => h.kind).sort(), sizeAt: [size.x, size.y], newW: Number(fields.w.value), newH: Number(fields.h.value) };
    form.remove();
    return out;
  });

  expect(r.handles, 'a position + a size handle').toBe(2);
  expect(r.kinds).toEqual(['move', 'size']);
  expect(r.sizeAt, 'size handle at the far corner (x+w, y+h)').toEqual([70, 60]);
  expect(r.newW, 'size drag set w = dragX − originX').toBe(90);
  expect(r.newH, 'size drag set h = dragY − originY').toBe(70);
});

test('Stage 3: a writable xy+dia group → a position + a radius (radial) handle; drag writes Ø = 2·distance', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const PT = await import('/wizards/ops/panelTypes.js');
    const def = { bindings: [{ param: 'qx', group: 'cg', role: 'x' }, { param: 'qy', group: 'cg', role: 'y' }, { param: 'qd', group: 'cg', role: 'dia' }] };
    const form = document.createElement('div'); form.id = 'wiz_user_form';
    const fields = {};
    for (const [role, val] of [['x', 50], ['y', 40], ['dia', 30]]) { const f = document.createElement('input'); f.dataset.param = ({ x: 'qx', y: 'qy', dia: 'qd' })[role]; f.value = val; form.append(f); fields[role] = f; }
    document.body.appendChild(form);

    const spec = PT.layoutSpecFromOp(def, { qx: 50, qy: 40, qd: 30 });
    const size = spec.handles.find((h) => /_size$/.test(h.id));
    spec.onDrag(size.id, { x: 50, y: 80 });   // drag the ring perpendicular: dist = 40 → Ø = 80
    const out = {
      drawnCircle: spec.items.filter((i) => i.kind === 'circle').length,
      handles: spec.handles.length, kinds: spec.handles.map((h) => h.kind).sort(),
      ringAt: [size.x, size.y],
      newDia: Number(fields.dia.value),
    };
    form.remove();
    return out;
  });

  expect(r.drawnCircle, 'the circle is drawn from x/y/dia').toBe(1);
  expect(r.handles, 'a position + a radius handle').toBe(2);
  expect(r.kinds).toEqual(['move', 'size']);
  expect(r.ringAt, 'ring handle on the +X radius (x + dia/2, y)').toEqual([65, 40]);
  expect(r.newDia, 'radius drag set Ø = 2 · distance from centre').toBe(80);
});

test('Stage 3: the 2D-circle role family is declarable end-to-end (decode + complete-group)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    // the author picks "2D circle · X/Y/Ø" on three number knobs → role-encoded widget values
    const decoded = ['ncirc-x', 'ncirc-y', 'ncirc-d'].map((w) => U.decodeCanvasWidget(w));
    const canvas = [
      { param: 'cx', _widget: 'ncircle', role: 'x', type: 'number', default: 0 },
      { param: 'cy', _widget: 'ncircle', role: 'y', type: 'number', default: 0 },
      { param: 'cd', _widget: 'ncircle', role: 'dia', type: 'number', default: 20 },
    ];
    const grouped = U.groupCanvasBindings(canvas, 'g');
    // an INCOMPLETE circle (missing Ø) must degrade to plain knobs (no group)
    const incomplete = U.groupCanvasBindings(canvas.slice(0, 2), 'g');
    return {
      decoded,
      groupCount: new Set(grouped.map((b) => b.group)).size,
      allSameGroup: grouped.every((b) => b.group === grouped[0].group),
      roles: grouped.map((b) => b.role).sort(),
      headWidget: grouped[0].widget,
      incompleteGrouped: incomplete.some((b) => b.group),
    };
  });

  expect(r.decoded, 'each role-encoded value decodes to the ncircle widget + its role').toEqual([
    { widget: 'ncircle', role: 'x' }, { widget: 'ncircle', role: 'y' }, { widget: 'ncircle', role: 'dia' },
  ]);
  expect(r.groupCount, 'the three roles form ONE complete circle group').toBe(1);
  expect(r.allSameGroup).toBe(true);
  expect(r.roles).toEqual(['dia', 'x', 'y']);
  expect(r.headWidget, 'group head carries the ncircle widget (resolveFormWidget reads it)').toBe('ncircle');
  expect(r.incompleteGrouped, 'an incomplete circle degrades to plain knobs (no group)').toBe(false);
});
