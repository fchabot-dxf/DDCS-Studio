import { test, expect } from '@playwright/test';

/**
 * PRODUCER half of the spatial-GUI feature — "2D point / rect (numbers)" authoring.
 *
 * An author tags a value as a NUMBER param that ALSO carries a spatial role (x / y / w / h). Unlike the canvas
 * pickers (xy-pad / rect), a number-role group renders as PLAIN number fields on the form (each tagged data-param),
 * NOT a mini-canvas — and the role is what lets layoutSpecFromOp put a DRAGGABLE handle on the big Form+2D preview.
 * Drag the preview → it writes the number fields (the spatial-GUI decision: continuous positions = drag the
 * preview, plain numbers on the block). This test drives the WHOLE chain end-to-end through the real authoring
 * extraction + the real form rendering + the real layout derivation — not a synthetic data-param stub.
 *
 * (The consumer seam alone is in custom-op-canvas-handles.spec; this proves a REAL authored op reaches it.)
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('authored 2D-point op: number fields render data-param, preview handle drags them, read() reflects it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const UO = await import('/blocks/userOps.js');
    const FW = await import('/ui/formWidgets.js');
    const PT = await import('/wizards/ops/panelTypes.js');

    // (1) AUTHOR: a template whose move-atom X/Y sockets hold param pills tagged "2D point" (point-x / point-y).
    const template = [{
      type: 'move',
      params: {
        x: { type: 'param', params: { name: 'px', value: 10, widget: 'point-x' } },
        y: { type: 'param', params: { name: 'py', value: 20, widget: 'point-y' } },
      },
    }];
    const bindings = UO.extractParamBlocks(template, new Set(), true);

    // the authoring extraction must yield ONE point group (x+y), with the role declared (not inferred from order)
    const grouped = bindings.filter((b) => b.group);
    const byRole = {}; for (const b of grouped) byRole[b.role] = b;

    // (2) RENDER the real form into the id layoutSpecFromOp queries
    const host = document.createElement('div'); host.id = 'wiz_user_form'; document.body.appendChild(host);
    const readers = FW.renderOpForm(host, bindings);
    const dataParams = [...host.querySelectorAll('[data-param]')].map((n) => n.dataset.param).sort();

    // (3) CONSUMER: layoutSpecFromOp derives the draggable handle from the roles (writable now → a real handle)
    const def = { bindings };
    const spec = PT.layoutSpecFromOp(def, { px: 10, py: 20 });
    const h = (spec.handles || [])[0];

    // (4) DRAG → writes the number fields; their input fires; readers reflect the new values
    let fired = 0; host.addEventListener('input', () => { fired++; });
    spec.onDrag(h.id, { x: 33, y: 44 });
    const readBack = {}; for (const read of readers) Object.assign(readBack, read());

    const out = {
      groupCount: grouped.length, roleX: !!byRole.x, roleY: !!byRole.y,
      m0widget: grouped[0] && grouped[0].widget,
      dataParams, fieldCount: host.querySelectorAll('input[type="number"]').length,
      handles: spec.handles.length, hKind: h && h.kind, hx: h && h.x, hy: h && h.y, items: spec.items.length,
      fired, readBack,
    };
    host.remove();
    return out;
  });

  // authoring → ONE point group with declared x/y roles, rendered as PLAIN numbers (member widget = 'point', not a canvas widget)
  expect(r.groupCount, 'x + y form one group').toBe(2);
  expect(r.roleX && r.roleY, 'both roles declared').toBe(true);
  expect(r.m0widget, 'the group is a number-role point, not a canvas widget').toBe('point');
  // the FIX: a number-role group renders TWO data-param number fields (before: one multi-widget swallowed y)
  expect(r.fieldCount, 'two plain number fields rendered').toBe(2);
  expect(r.dataParams, 'both fields are writable (data-param)').toEqual(['px', 'py']);
  // the consumer seam now reaches a REAL authored op: one move handle at the param values
  expect(r.items).toBe(1);
  expect(r.handles, 'a draggable handle derived from the roles').toBe(1);
  expect(r.hKind).toBe('move');
  expect(r.hx).toBe(10); expect(r.hy).toBe(20);
  // dragging the preview wrote the number fields, fired their input, and read() reflects it
  expect(r.fired, 'each written field fired input (drives update())').toBe(2);
  expect(r.readBack, 'the form reads back the dragged values').toEqual({ px: 33, py: 44 });
});

test('authored 2D-rect (numbers): four data-param fields; preview size-handle writes w/h', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const UO = await import('/blocks/userOps.js');
    const FW = await import('/ui/formWidgets.js');
    const PT = await import('/wizards/ops/panelTypes.js');

    const template = [{
      type: 'rect', params: {
        x: { type: 'param', params: { name: 'rx', value: 10, widget: 'nrect-x' } },
        y: { type: 'param', params: { name: 'ry', value: 20, widget: 'nrect-y' } },
        w: { type: 'param', params: { name: 'rw', value: 60, widget: 'nrect-w' } },
        h: { type: 'param', params: { name: 'rh', value: 40, widget: 'nrect-h' } },
      },
    }];
    const bindings = UO.extractParamBlocks(template, new Set(), true);

    const host = document.createElement('div'); host.id = 'wiz_user_form'; document.body.appendChild(host);
    FW.renderOpForm(host, bindings);
    const dataParams = [...host.querySelectorAll('[data-param]')].map((n) => n.dataset.param).sort();

    const def = { bindings };
    const spec = PT.layoutSpecFromOp(def, { rx: 10, ry: 20, rw: 60, rh: 40 });
    const size = spec.handles.find((hh) => /_size$/.test(hh.id));
    spec.onDrag(size.id, { x: 100, y: 90 });   // rect origin (10,20) → w=90, h=70

    const fx = (p) => Number(host.querySelector(`[data-param="${p}"]`).value);
    const out = {
      dataParams, fieldCount: host.querySelectorAll('input[type="number"]').length,
      kinds: spec.handles.map((hh) => hh.kind).sort(), newW: fx('rw'), newH: fx('rh'),
    };
    host.remove();
    return out;
  });

  expect(r.fieldCount, 'four plain number fields').toBe(4);
  expect(r.dataParams).toEqual(['rh', 'rw', 'rx', 'ry']);
  expect(r.kinds, 'a position + a size handle').toEqual(['move', 'size']);
  expect(r.newW, 'size drag wrote w from the origin').toBe(90);
  expect(r.newH, 'size drag wrote h from the origin').toBe(70);
});

test('both author surfaces offer the same role widgets: bridge param-block dropdown == canonical CANVAS_ROLE_WIDGETS', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const { fieldOptions } = await import('/blocks/blockly/bridge.js');
    const { CANVAS_ROLE_WIDGETS } = await import('/blocks/userOps.js');
    return {
      dropdown: fieldOptions({ type: 'param' }, 'widget'),
      expected: ['number', 'slider', 'dropdown', 'toggle', ...CANVAS_ROLE_WIDGETS],
    };
  });
  // one source of truth (#4): the GUI param-block widget dropdown IS the canonical list — they cannot drift
  expect(r.dropdown).toEqual(r.expected);
  // and it actually offers the new number-role choices (author parity with dev-mode)
  expect(r.dropdown).toEqual(expect.arrayContaining([['2D point · X', 'point-x'], ['2D rect · W', 'nrect-w']]));
});

test('canvas xy-pad is unchanged: renders a mini-canvas (no data-param), no dead preview handle; lone point degrades', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const UO = await import('/blocks/userOps.js');
    const FW = await import('/ui/formWidgets.js');
    const PT = await import('/wizards/ops/panelTypes.js');

    // an xy-pad canvas widget (the OLD path) must STILL render as one mini-canvas (the widget owns its value) —
    // so no data-param field, and layoutSpecFromOp must NOT put a dead handle over it.
    const tplPad = [{ type: 'move', params: {
      x: { type: 'param', params: { name: 'cx', value: 10, widget: 'xy-x' } },
      y: { type: 'param', params: { name: 'cy', value: 20, widget: 'xy-y' } },
    } }];
    const padBinds = UO.extractParamBlocks(tplPad, new Set(), true);
    const host = document.createElement('div'); host.id = 'wiz_user_form'; document.body.appendChild(host);
    FW.renderOpForm(host, padBinds);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));   // let the canvas draw
    const padDataParams = host.querySelectorAll('[data-param]').length;
    const padSpec = PT.layoutSpecFromOp({ bindings: padBinds }, { cx: 10, cy: 20 });
    host.remove();

    // a LONE point-x (incomplete group) degrades to a plain number knob with NO group (no dead handle)
    const tplLone = [{ type: 'move', params: { x: { type: 'param', params: { name: 'lx', value: 5, widget: 'point-x' } } } }];
    const loneBinds = UO.extractParamBlocks(tplLone, new Set(), true);

    return {
      padDataParams, padHandles: padSpec.handles.length, padItems: padSpec.items.length,
      loneGrouped: loneBinds.filter((b) => b.group).length, loneWidget: loneBinds[0] && loneBinds[0].widget,
      decode: UO.decodeCanvasWidget('point-x'),
    };
  });

  expect(r.decode, 'point-x decodes to a number-role point').toEqual({ widget: 'point', role: 'x' });
  expect(r.padDataParams, 'a canvas xy-pad renders NO data-param field (it owns its value)').toBe(0);
  expect(r.padItems, 'the xy-pad point is still drawn on the preview').toBe(1);
  expect(r.padHandles, 'but no dead preview handle over a canvas widget').toBe(0);
  expect(r.loneGrouped, 'an incomplete point group degrades — no group').toBe(0);
  expect(r.loneWidget, 'a lone point becomes a plain number knob').toBeUndefined();
});
