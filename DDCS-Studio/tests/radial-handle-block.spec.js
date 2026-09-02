import { test, expect } from '@playwright/test';

/**
 * BACKLOG #71, FOURTH GESTURE (t2521), WIRED FOR REAL (t2525) — the GUI RADIAL-HANDLE canvas block.
 * `radial_handle`, nested inside a `feature_canvas` block's own mouth, DECLARES a draggable Ø/pitch (radius-
 * only) handle at a FIXED centre (cx, cy) and bearing (a, degrees), whose `field` NAMES an EXISTING param (a
 * MUST-MATCH picker, bridge.js HANDLE_ANCHOR_FIELDS) an "Op Param" `formfield` elsewhere in the stack already
 * binds to a real atom socket. `handleBindingsFromStack`/`attach()` (userOps.js) look up that param and MERGE
 * this handle's anchor onto the real binding, so dragging reaches emit.
 *
 * WHERE IT DIFFERS: needed a NEW `anchor.kind === 'radial'` render branch (no prior declared-anchor path, like
 * rect). The one real translation: canvasWidgets.js's own gesture wants a WORLD RADIUS + RADIANS bearing, while
 * the declared field holds a DIAMETER-scaled value (rScale=2) at a bearing in DEGREES — the render branch
 * divides by rScale and converts degrees to radians before building the decl.
 */

const OPTYPE = 'user_rdh_pilot';

const PILOT = `
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    try { U.deleteUserOp('${OPTYPE}'); } catch (_) {}
    const template = [{
        type: 'user_root', params: {},
        uiChildren: [
            { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                { type: 'radial_handle', params: { field: 'holedia', cx: '0', cy: '0', a: '0', rScale: '2', minR: '2', maxR: '', label: 'Ø' } },
            ] },
            { type: 'param_group', params: { group: 'Test' }, children: [
                { type: 'formfield', params: { param: 'holedia', label: 'Dia', dflt: '20', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
            ] },
        ],
        children: [
            { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
        ],
    }];
    U.createUserOp(U.userOpFromStack('${OPTYPE}', 'RDH Pilot', template, [], 'form2d'));
`;

test('round-trip: a radial_handle nested in feature_canvas MERGES its anchor onto the real binding it names, or fails visibly if none exists', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const fc = { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
            { type: 'radial_handle', params: { field: 'holedia', cx: '0', cy: '0', a: '0', rScale: '2', minR: '2', maxR: '', label: 'Ø' } },
        ] };
        const real = [{ param: 'holedia', type: 'number', match: { type: 'progstart' }, key: 'clearance', default: 20, blockIndex: 0 }];
        const anchors = U.handleBindingsFromStack([fc], real);
        const merged = U.mergeHandleAnchors(real, anchors);
        const back = U.handleBindingsToBlocks(merged);
        const unresolvedAnchors = U.handleBindingsFromStack([fc], []);
        return { anchors, merged, back0: back[0], nBack: back.length, unresolvedAnchors };
    });
    expect(r.anchors.length, 'one radial_handle -> one anchor entry').toBe(1);
    expect(r.anchors[0].role).toBe('r');
    expect(r.anchors[0].param).toBe('holedia');
    expect(r.anchors[0].match, 't2525 -- MERGED from the real binding, not socket-less').toEqual({ type: 'progstart' });
    expect(r.anchors[0].key).toBe('clearance');
    expect(r.anchors[0].default, "the REAL binding's own default wins").toBe(20);
    expect(r.anchors[0].anchor, 'the anchor is DECLARED {kind:radial, cx, cy, a, rScale, minR, maxR, label}').toEqual({ kind: 'radial', cx: 0, cy: 0, a: 0, rScale: 2, minR: 2, maxR: null, label: 'Ø' });
    expect(r.merged.filter((b) => b.param === 'holedia').length, 'exactly one entry, no duplicates').toBe(1);
    // reverse round-trip: the merged binding still re-nests into a feature_canvas carrying the SAME radial_handle
    expect(r.nBack).toBe(1);
    expect(r.back0.type).toBe('feature_canvas');
    expect(r.back0.children).toEqual([{ type: 'radial_handle', params: { field: 'holedia', value: '20', cx: '0', cy: '0', a: '0', rScale: '2', minR: '2', maxR: '', label: 'Ø' } }]);
    // FAIL VISIBLY: no matching real binding -> anchorUnresolved
    expect(r.unresolvedAnchors.length).toBe(1);
    expect(r.unresolvedAnchors[0].anchorUnresolved).toBe(true);
});

test('the RADIAL gesture (radius-only) writes the DRAGGED, rScale-mapped, clamped distance from its fixed centre -- gesture math itself is UNCHANGED by t2525', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { CANVAS_GESTURES } = await import('/viz/canvasWidgets.js');
        const d = { type: 'radial', id: 'g_r', field: 'holedia', cx: 0, cy: 0, a: 0, r: 10, rScale: 2, minR: 2, maxR: null, value: 20, label: 'Ø' };
        const place = CANVAS_GESTURES.radial.place(d);                    // at rest: r=10 (radius) along a=0 (+X) -> (10, 0)
        const drag = CANVAS_GESTURES.radial.drag(d, { x: 15, y: 0 });     // drag to world (15,0) -> dist 15 * rScale(2) = 30
        const dragClamped = CANVAS_GESTURES.radial.drag(d, { x: 0.5, y: 0 });   // dist 0.5*2=1, below minR(2) -> clamps to 2
        return { place, drag, dragClamped };
    });
    expect(r.place, 'the handle rests at centre + radius along the fixed bearing').toEqual({ x: 10, y: 0, kind: 'size', label: 'Ø', value: 20 });
    expect(r.drag, 'a drag writes field = distance * rScale (an independent truth)').toEqual({ holedia: 30 });
    expect(r.dragClamped, 'a drag below the declared minR clamps at the bound').toEqual({ holedia: 2 });
});

test('a radial-handle op: def.bindings MERGE the anchor onto the real binding; layoutSpecFromOp still renders the handle at centre+radius (value/rScale); emit CHANGES when dragged (t2525 -- the central fix)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'box', show: true } }); });
    await page.evaluate(async (code) => { await eval('(async()=>{' + code + '})()'); }, PILOT.replace(/\$\{OPTYPE\}/g, OPTYPE));
    await page.evaluate((t) => window.openWiz(t), OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(async (t) => {
        const U = await import('/blocks/userOps.js');
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.listUserOps().find((d) => d.opType === t);
        const params = U.defaultParams(def);
        const anchored = (def.bindings || []).find((b) => b.anchor);
        const spec = layoutSpecFromOp(def, params, null, null, null, {}, () => {}, null);
        const h = (spec.handles || []).find((x) => /_r$/.test(x.id) && x.kind === 'size');
        const emitDefault = emitMapped(builderOf(t)(U.defaultParams(def))).text;
        const emitDragged = emitMapped(builderOf(t)({ ...U.defaultParams(def), holedia: 8 })).text;
        return {
            anchorKind: anchored && anchored.anchor && anchored.anchor.kind,
            hasMatchKey: anchored && anchored.blockIndex !== undefined && anchored.key !== undefined,
            hasHandle: !!h, handleX: h && h.x, handleY: h && h.y, handleValue: h && h.value,
            emitChanges: emitDefault !== emitDragged,
        };
    }, OPTYPE);
    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, OPTYPE);
    expect(r.anchorKind, 'the binding carries the DECLARED anchor kind (radial)').toBe('radial');
    expect(r.hasMatchKey, 't2525 -- the anchor-carrying binding is now ALSO the real one').toBe(true);
    expect(r.hasHandle, 'layoutSpecFromOp renders a draggable radial handle for the merged binding, unchanged for the resolved case').toBe(true);
    expect(r.handleX, 'the handle sits at centre + radius (value/rScale = 20/2 = 10) along bearing 0 (+X)').toBe(10);
    expect(r.handleY).toBe(0);
    expect(r.handleValue).toBe(20);
    expect(r.emitChanges, 't2525 -- the handle now reaches emit: dragging changes the G-code (was byte-identical before this fix)').toBe(true);
});

test.use({ viewport: { width: 2600, height: 1000 } });
test('DRIVE THE APP, THE t2525 BAR: a formfield placed FIRST (must-match picker needs it to exist), then feature_canvas + radial_handle picking that param, real save, a REAL reload, then a REAL mouse drag on the rendered SVG handle changes the field AND the emitted G-code', async ({ page }) => {
    async function clearSearch() { await page.evaluate(() => { const s = document.querySelector('.blk-search'); if (s) { s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); } }); await page.waitForTimeout(100); }
    async function searchFor(text) { await clearSearch(); const s = page.locator('.blk-search'); await s.click(); await s.fill(text); await page.waitForTimeout(250); }
    async function flyoutBlockCenter(type) {
        return page.evaluate((t) => {
            const ws = window.__blkws;
            const fws = ws.getToolbox().getFlyout().getWorkspace();
            const blk = fws.getAllBlocks().find((b) => b.type === t);
            if (!blk) return null;
            const root = blk.getSvgRoot();
            const target = root.querySelector('text.blocklyText, .blocklyText') || root.querySelector('path.blocklyPath') || root;
            const rect = target.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }, type);
    }
    async function flyoutDragOffset(type) {
        return page.evaluate((t) => {
            const ws = window.__blkws;
            const fws = ws.getToolbox().getFlyout().getWorkspace();
            const blk = fws.getAllBlocks().find((b) => b.type === t);
            const root = blk.getSvgRoot();
            const grabRect = (root.querySelector('text.blocklyText, .blocklyText') || root).getBoundingClientRect();
            const grabPt = { x: grabRect.x + grabRect.width / 2, y: grabRect.y + grabRect.height / 2 };
            const conn = blk.previousConnection || blk.outputConnection;
            if (!conn) return { dx: 0, dy: 0 };
            const off = conn.getOffsetInBlock();
            const blockRect = root.getBoundingClientRect();
            const connScreen = { x: blockRect.left + off.x * fws.scale, y: blockRect.top + off.y * fws.scale };
            return { dx: grabPt.x - connScreen.x, dy: grabPt.y - connScreen.y };
        }, type);
    }
    async function dragFlyoutBlockTo(type, targetPt) {
        const grab = await flyoutBlockCenter(type);
        const off = await flyoutDragOffset(type);
        const dropX = targetPt.x + off.dx, dropY = targetPt.y + off.dy;
        await page.mouse.move(grab.x, grab.y);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.move(grab.x + 30, grab.y + 20, { steps: 5 });
        await page.mouse.move(dropX, dropY, { steps: 20 });
        await page.waitForTimeout(80);
        await page.mouse.move(dropX, dropY, { steps: 2 });
        await page.mouse.up();
        await page.waitForTimeout(300);
    }
    async function mouthPoint(blockType, inputName) {
        return page.evaluate(({ blockType, inputName }) => {
            const ws = window.__blkws;
            const blk = ws.getAllBlocks(false).find((b) => b.type === blockType);
            const inp = blk.inputList.find((i) => i.name === inputName);
            const off = inp.connection.getOffsetInBlock();
            const rect = blk.getSvgRoot().getBoundingClientRect();
            return { x: rect.left + off.x * ws.scale, y: rect.top + off.y * ws.scale };
        }, { blockType, inputName });
    }
    const RESOLVE_SRC = "(ws,ref)=>ref[0]==='#' ? ws.getAllBlocks(false).find(b=>b.id===ref.slice(1)) : ws.getAllBlocks(false).find(b=>b.type===ref)";
    async function stackBottomPoint(ref) {
        return page.evaluate(({ ref, RESOLVE_SRC }) => {
            const ws = window.__blkws;
            const blk = eval(RESOLVE_SRC)(ws, ref);
            const conn = blk.nextConnection;
            const off = conn.getOffsetInBlock();
            const rect = blk.getSvgRoot().getBoundingClientRect();
            return { x: rect.left + off.x * ws.scale, y: rect.top + off.y * ws.scale };
        }, { ref, RESOLVE_SRC });
    }
    async function centerOn(ref) {
        await page.evaluate(({ ref, RESOLVE_SRC }) => { const ws = window.__blkws; const blk = eval(RESOLVE_SRC)(ws, ref); if (blk) ws.centerOnBlock(blk.id, true); }, { ref, RESOLVE_SRC });
        await page.waitForTimeout(400);
    }
    async function fieldRect(blockType, fieldName) {
        return page.evaluate(({ blockType, fieldName, RESOLVE_SRC }) => {
            const ws = window.__blkws;
            const blk = eval(RESOLVE_SRC)(ws, blockType);
            const f = blk.getField(fieldName);
            const group = f.fieldGroup_ || f.getSvgRoot();
            const el = (group && group.querySelector('text')) || (f.getClickTarget_ && f.getClickTarget_()) || group;
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, { blockType, fieldName, RESOLVE_SRC });
    }
    async function setDropdownField(blockType, fieldName, optionText) {
        await clearSearch();
        await centerOn(blockType);
        const rect = await fieldRect(blockType, fieldName);
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(250);
        await page.locator('.blocklyMenuItem', { hasText: optionText }).first().click({ timeout: 3000 });
        await page.waitForTimeout(150);
    }
    async function setTextField(blockType, fieldName, value) {
        await clearSearch();
        const rect = await fieldRect(blockType, fieldName);
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(150);
        await page.keyboard.press('Control+A');
        await page.keyboard.type(String(value));
        await page.keyboard.press('Tab');
        await page.waitForTimeout(150);
    }
    async function setPickerField(blockType, fieldName, matchText) {
        await clearSearch();
        const rect = await fieldRect(blockType, fieldName);
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(250);
        await page.locator('.ddcs-picker-row', { hasText: matchText }).first().click({ timeout: 3000 });
        await page.waitForTimeout(150);
    }

    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    // 1) user_root
    await searchFor('Define Custom Wizard');
    await dragFlyoutBlockTo('user_root', { x: 1900, y: 220 });

    // 2) progstart into EXECUTION
    const execMouth = await mouthPoint('user_root', 'EXECUTION');
    await searchFor('program start');
    await dragFlyoutBlockTo('progstart', execMouth);

    // 3) param_group into PRESENTATION, then a formfield (Op Param -> progstart.clearance) -- BEFORE the handle
    const presMouth = await mouthPoint('user_root', 'PRESENTATION');
    await searchFor('parameter group');
    await dragFlyoutBlockTo('param_group', presMouth);
    await setTextField('param_group', 'GROUP', 'Test');

    const pgMouth = await mouthPoint('param_group', 'DO');
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', pgMouth);
    await setTextField('formfield', 'PARAM', 'holedia');
    await setTextField('formfield', 'LABEL', 'Dia');
    await setTextField('formfield', 'DFLT', '20');
    await setDropdownField('formfield', 'BINDMODE', 'Op Param');
    await setPickerField('formfield', 'ATOMTYPE', 'progstart');
    await setTextField('formfield', 'KEY', 'clearance');

    // 4) feature_canvas stacked after param_group, then radial_handle into ITS OWN mouth, picking 'holedia'
    const pgBottom = await stackBottomPoint('param_group');
    await searchFor('feature canvas');
    await dragFlyoutBlockTo('feature_canvas', pgBottom);
    await setDropdownField('feature_canvas', 'PANEL', 'form2d');

    const fcMouth = await mouthPoint('feature_canvas', 'DO');
    await searchFor('radial handle');
    await dragFlyoutBlockTo('radial_handle', fcMouth);
    await setPickerField('radial_handle', 'FIELD', 'holedia');

    const fieldsSet = await page.evaluate(() => {
        const ws = window.__blkws;
        return {
            panel: ws.getAllBlocks(false).find((b) => b.type === 'feature_canvas').getFieldValue('PANEL'),
            field: ws.getAllBlocks(false).find((b) => b.type === 'radial_handle').getFieldValue('FIELD'),
        };
    });
    expect(fieldsSet.panel).toBe('form2d');
    expect(fieldsSet.field, 't2525 -- the picker committed an EXISTING param name, not free text').toBe('holedia');

    // 5) save via the real dialog
    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 't2525 radial handle pilot (live)');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(500);

    // 6) a REAL reload
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const savedOpType = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 't2525 radial handle pilot (live)');
        return d ? d.opType : null;
    });
    expect(savedOpType, 'the saved wizard survives a REAL reload, found by listUserOps').toBeTruthy();

    await page.evaluate((t) => window.openWiz(t), savedOpType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);

    const rendered = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const c = document.getElementById('userVizContainer');
        const svg = c && c.querySelector('svg');
        return {
            hasField: !!f.querySelector('[data-param="holedia"]'),
            svgPresent: !!svg,
            handles: svg ? svg.querySelectorAll('circle.fc-handle, polygon.fc-handle, .fc-handle, [data-handle]').length : 0,
        };
    });
    expect(rendered.hasField, 'the holedia param renders a real form row').toBe(true);
    expect(rendered.svgPresent, 'the 2D FeatureCanvas SVG renders').toBe(true);
    expect(rendered.handles, 'at least one interactive handle renders on the canvas').toBeGreaterThan(0);

    // 7) THE REAL GESTURE: a mouse drag on the rendered SVG handle
    const handleRect = await page.evaluate(() => {
        const svg = document.getElementById('userVizContainer').querySelector('svg');
        const h = svg.querySelector('circle.fc-handle, polygon.fc-handle, .fc-handle, [data-handle]');
        const r = h.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const before = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="holedia"]').value);
    await page.mouse.move(handleRect.x, handleRect.y);
    await page.mouse.down();
    await page.mouse.move(handleRect.x + 40, handleRect.y, { steps: 15 });
    await page.mouse.move(handleRect.x + 40, handleRect.y, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="holedia"]').value);

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2525-radial-handle-emit-wired.png', clip: _b }); }

    const emit = await page.evaluate(async ({ t, before, after }) => {
        const U = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.listUserOps().find((d) => d.opType === t);
        const base = U.defaultParams(def);
        const emitBefore = emitMapped(builderOf(t)({ ...base, holedia: Number(before) })).text;
        const emitAfter = emitMapped(builderOf(t)({ ...base, holedia: Number(after) })).text;
        return { emitBefore, emitAfter };
    }, { t: savedOpType, before, after });

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, savedOpType);

    expect(after, 'a REAL mouse drag on the SVG handle changed the holedia field').not.toBe(before);
    expect(emit.emitAfter, 't2525 -- THE central fix, verified live: the exact before/after field values a real drag produced emit DIFFERENT G-code (was byte-identical before this fix)').not.toBe(emit.emitBefore);
});
