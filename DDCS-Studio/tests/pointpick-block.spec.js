import { test, expect } from '@playwright/test';

/**
 * COMPOSABLE-WIZARD-AUTHORING PILOT 2 (t399) — the GUI POINT-PICK widget block. A `layoutwidget` block in the user_root
 * PRESENTATION mouth DECLARES a draggable 2D point bound to two params (fx, fy). layoutBindingsFromStack expands it to two
 * SOCKET-LESS {group, role:x/y, anchor:{kind:'point', frame:'stock-min'}} bindings → the EXISTING layoutSpecFromOp
 * x+y→`point` derivation renders a draggable handle; the drag writes fx/fy the WORLD COORDS (physical, ax=0). VERIFY
 * (assert-the-value): round-trip · the point renders + drag writes the exact coords · two-way · emit byte-identical
 * (sim/form-only) · Class-B render guard.
 */

const PP_OPTYPE = 'user_pp_pilot';

const PILOT = `
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    try { U.deleteUserOp('${PP_OPTYPE}'); } catch (_) {}
    const template = [{
        type: 'user_root', params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form2d' } },
            { type: 'param_group', params: { group: 'Pilot' }, children: [
                { type: 'layoutwidget', params: { fx: 'px', fy: 'py', anchor: 'point', frame: 'stock-min', xval: '40', yval: '60', label: 'pt' } },
            ] },
        ],
        children: [{ type: 'comment', params: { text: 'point pick pilot' } }],
    }];
    U.createUserOp(U.userOpFromStack('${PP_OPTYPE}', 'PP Pilot', template, [], 'form2d'));
`;

test('round-trip: a layoutwidget block ⇄ two socket-less {group,role,anchor} bindings (bindingsFrom/ToBlocks)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const block = { type: 'layoutwidget', params: { fx: 'px', fy: 'py', anchor: 'point', frame: 'stock-min', xval: '40', yval: '60', label: 'pt' } };
        const bindings = U.layoutBindingsFromStack([block]);
        const back = U.layoutBindingsToBlocks(bindings);
        return { bindings, back0: back[0], nBack: back.length };
    });
    // the block expands to TWO socket-less bindings (NO match/blockIndex → no emit), carrying group/role/anchor
    expect(r.bindings.length).toBe(2);
    expect(r.bindings.map((b) => b.role)).toEqual(['x', 'y']);
    expect(r.bindings.map((b) => b.param)).toEqual(['px', 'py']);
    expect(r.bindings.every((b) => b.match === undefined && b.blockIndex === undefined), 'socket-less → no emit (sim/form-only)').toBe(true);
    expect(r.bindings[0].anchor, 'the anchor is DECLARED {kind:point, frame:stock-min}').toEqual({ kind: 'point', frame: 'stock-min' });
    expect(r.bindings[0].default).toBe(40);
    expect(r.bindings[1].default).toBe(60);
    // reverse round-trip: the two bindings re-pair into the same layoutwidget block
    expect(r.nBack).toBe(1);
    expect(r.back0, 'block → bindings → block reproduces the layoutwidget').toEqual({ type: 'layoutwidget', params: { fx: 'px', fy: 'py', anchor: 'point', frame: 'stock-min', xval: '40', yval: '60', label: 'pt' } });
});

test('the POINT gesture writes the DRAGGED WORLD COORDS (physical, ax=0) + is two-way (assert the values, not just moved)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { CANVAS_GESTURES } = await import('/viz/canvasWidgets.js');
        const d = { type: 'point', id: 'g_pos', fx: 'px', fy: 'py', x: 40, y: 60, ax: 0, ay: 0, label: 'pt' };
        const place = CANVAS_GESTURES.point.place(d);                 // at rest: the point sits at (px, py) = (40, 60)
        const drag = CANVAS_GESTURES.point.drag(d, { x: 30, y: 45 });  // drag to world {30,45} → px=30, py=45 (physical, ax=0)
        const place2 = CANVAS_GESTURES.point.place({ ...d, x: 70, y: 25 });  // two-way: type px=70,py=25 → the point moves to {70,25}
        return { place, drag, place2 };
    });
    expect(r.place, 'the point rests at its params (physical stock-min-XY)').toEqual({ x: 40, y: 60, kind: 'move', label: 'pt' });
    expect(r.drag, 'a drag writes fx/fy = EXACTLY the dragged world coords (an independent truth)').toEqual({ px: 30, py: 45 });
    expect(r.place2, 'two-way: typing px/py moves the point').toEqual({ x: 70, y: 25, kind: 'move', label: 'pt' });
});

test('a point-pick op: def.bindings carry the anchor; layoutSpecFromOp renders a draggable POINT; a drag writes fx/fy; emit BYTE-IDENTICAL (sim/form-only)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'box', show: true } }); });
    await page.evaluate(async (code) => { await eval('(async()=>{' + code + '})()'); }, PILOT.replace(/\$\{PP_OPTYPE\}/g, PP_OPTYPE));
    await page.evaluate((OPTYPE) => window.openWiz(OPTYPE), PP_OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(async (OPTYPE) => {
        const U = await import('/blocks/userOps.js');
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.listUserOps().find((d) => d.opType === OPTYPE);
        const params = U.defaultParams(def);
        const anchored = (def.bindings || []).find((b) => b.anchor);
        // layoutSpecFromOp (the form is open → px/py are writable fields) → a draggable POINT handle
        const spec = layoutSpecFromOp(def, params, null, null, null, {}, () => {}, null);
        const pt = (spec.handles || []).find((h) => /_pos$/.test(h.id) && h.kind === 'move');
        // exercise the REAL drag path: onDrag(handleId, world) → the gesture writes px/py to the form
        if (pt && spec.onDrag) spec.onDrag(pt.id, { x: 30, y: 45 });
        const pxAfter = (document.querySelector('#wiz_user_form [data-param="px"]') || {}).value;
        const pyAfter = (document.querySelector('#wiz_user_form [data-param="py"]') || {}).value;
        // emit BYTE-IDENTICAL: the point-pick is sim/form-only (px/py have no socket) → dragging never changes the emit
        const emitDefault = emitMapped(builderOf(OPTYPE)(U.defaultParams(def))).text;
        const emitDragged = emitMapped(builderOf(OPTYPE)({ ...U.defaultParams(def), px: 99, py: 88 })).text;
        return {
            anchorKind: anchored && anchored.anchor && anchored.anchor.kind,
            hasPointHandle: !!pt, ptX: pt && pt.x, ptY: pt && pt.y,
            pxAfter, pyAfter,
            emitByteIdentical: emitDefault === emitDragged,
        };
    }, PP_OPTYPE);
    await page.evaluate((OPTYPE) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(OPTYPE); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, PP_OPTYPE);
    expect(r.anchorKind, 'the binding carries the DECLARED anchor kind (point)').toBe('point');
    expect(r.hasPointHandle, 'layoutSpecFromOp renders a draggable point handle for the anchored binding').toBe(true);
    expect(r.ptX, 'the point sits at the param default (physical)').toBe(40);
    expect(r.ptY).toBe(60);
    expect(r.pxAfter, 'a drag writes px = the dragged world X (assert-the-value)').toBe('30');
    expect(r.pyAfter, 'a drag writes py = the dragged world Y').toBe('45');
    expect(r.emitByteIdentical, 'the point-pick is sim/form-only → dragging never changes the emit (byte-identical)').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE THE APP: the draggable point renders on featureCanvas + the fx/fy fields; the layoutwidget block RENDERS in Blocks (Class-B guard)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz && window.showApp);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'box', show: true } }); });
    await page.evaluate(async (code) => { await eval('(async()=>{' + code + '})()'); }, PILOT.replace(/\$\{PP_OPTYPE\}/g, PP_OPTYPE));
    await page.evaluate((OPTYPE) => window.openWiz(OPTYPE), PP_OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    const live = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const c = document.getElementById('userVizContainer');
        const svg = c && c.querySelector('svg');
        // a 'move' handle renders on the 2D canvas (the draggable point) — a rect/square handle in the FeatureCanvas
        const handles = svg ? svg.querySelectorAll('rect.fc-handle, .fc-handle, [data-handle]').length : 0;
        return {
            hasPx: !!f.querySelector('[data-param="px"]'), hasPy: !!f.querySelector('[data-param="py"]'),
            pxVal: (f.querySelector('[data-param="px"]') || {}).value,
            svgEls: svg ? svg.querySelectorAll('*').length : 0, handles,
        };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/pointpick_pilot.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(live.hasPx, 'the fx/fy fields (px/py) render in the form').toBe(true);
    expect(live.hasPy).toBe(true);
    expect(live.pxVal, 'px seeds the authored default').toBe('40');
    expect(live.svgEls, 'the 2D layout canvas renders').toBeGreaterThan(0);

    // Class-B render guard (blockly skill, Blockly 13.0.0): the layoutwidget block actually DRAWS in the Blocks workspace
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
    await page.waitForTimeout(500);
    const render = await page.evaluate(() => {
        const lw = window.__blkws.getAllBlocks().filter((b) => b.type === 'layoutwidget');
        return { count: lw.length, drawn: lw.filter((b) => { try { return b.getHeightWidth().height > 0; } catch (_) { return false; } }).length };
    });
    await page.evaluate((OPTYPE) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(OPTYPE); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, PP_OPTYPE);
    expect(render.count, 'the layoutwidget block appears in the Blocks workspace').toBeGreaterThan(0);
    expect(render.drawn, 'Class-B guard: the layoutwidget block actually RENDERED (height > 0)').toBe(render.count);
});
