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
