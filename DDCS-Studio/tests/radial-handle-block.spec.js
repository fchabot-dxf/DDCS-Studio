import { test, expect } from '@playwright/test';

/**
 * BACKLOG #71, FOURTH GESTURE THIS TURN (t2521) — the GUI RADIAL-HANDLE canvas block. `radial_handle`, nested
 * inside a `feature_canvas` block's own mouth, DECLARES a draggable Ø/pitch (radius-only) handle bound to ONE
 * param at a FIXED centre (cx, cy) and bearing (a, degrees). `handleBindingsFromStack` expands it to one
 * socket-less {group, role:'r', anchor:{kind:'radial', cx, cy, a, rScale, minR, maxR, label}} binding.
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
                { type: 'radial_handle', params: { field: 'holedia', value: '20', cx: '0', cy: '0', a: '0', rScale: '2', minR: '2', maxR: '', label: 'Ø' } },
            ] },
        ],
        children: [{ type: 'comment', params: { text: 'radial handle pilot' } }],
    }];
    U.createUserOp(U.userOpFromStack('${OPTYPE}', 'RDH Pilot', template, [], 'form2d'));
`;

test('round-trip: a radial_handle nested in feature_canvas <-> one socket-less {group,role,anchor} binding (bindingsFrom/ToBlocks)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const fc = { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
            { type: 'radial_handle', params: { field: 'holedia', value: '20', cx: '0', cy: '0', a: '0', rScale: '2', minR: '2', maxR: '', label: 'Ø' } },
        ] };
        const bindings = U.handleBindingsFromStack([fc]);
        const back = U.handleBindingsToBlocks(bindings);
        return { bindings, back0: back[0], nBack: back.length };
    });
    expect(r.bindings.length, 'one radial_handle -> one socket-less binding').toBe(1);
    expect(r.bindings[0].role).toBe('r');
    expect(r.bindings[0].param).toBe('holedia');
    expect(r.bindings[0].default).toBe(20);
    expect(r.bindings[0].match === undefined && r.bindings[0].blockIndex === undefined, 'socket-less -> no emit (sim/form-only)').toBe(true);
    expect(r.bindings[0].anchor, 'the anchor is DECLARED {kind:radial, cx, cy, a, rScale, minR, maxR, label}').toEqual({ kind: 'radial', cx: 0, cy: 0, a: 0, rScale: 2, minR: 2, maxR: null, label: 'Ø' });
    // reverse round-trip: the binding re-nests into a feature_canvas carrying the SAME radial_handle
    expect(r.nBack).toBe(1);
    expect(r.back0.type).toBe('feature_canvas');
    expect(r.back0.children).toEqual([{ type: 'radial_handle', params: { field: 'holedia', value: '20', cx: '0', cy: '0', a: '0', rScale: '2', minR: '2', maxR: '', label: 'Ø' } }]);
});

test('the RADIAL gesture (radius-only) writes the DRAGGED, rScale-mapped, clamped distance from its fixed centre', async ({ page }) => {
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

test('a radial-handle op: def.bindings carry the anchor; layoutSpecFromOp renders the handle at centre+radius (value/rScale); emit BYTE-IDENTICAL (sim/form-only, no socket)', async ({ page }) => {
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
        const emitDragged = emitMapped(builderOf(t)({ ...U.defaultParams(def), holedia: 40 })).text;
        return {
            anchorKind: anchored && anchored.anchor && anchored.anchor.kind,
            hasHandle: !!h, handleX: h && h.x, handleY: h && h.y, handleValue: h && h.value,
            emitByteIdentical: emitDefault === emitDragged,
        };
    }, OPTYPE);
    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, OPTYPE);
    expect(r.anchorKind, 'the binding carries the DECLARED anchor kind (radial)').toBe('radial');
    expect(r.hasHandle, 'layoutSpecFromOp renders a draggable radial handle for the anchored binding').toBe(true);
    expect(r.handleX, 'the handle sits at cx + radius(value/rScale=20/2=10) along bearing a=0 (+X)').toBe(10);
    expect(r.handleY).toBe(0);
    expect(r.handleValue, 'the displayed value is the raw diameter param, not the radius').toBe(20);
    expect(r.emitByteIdentical, 'the radial handle is sim/form-only -> dragging never changes the emit (byte-identical)').toBe(true);
});

test.use({ viewport: { width: 1600, height: 1000 } });
test('DRIVE THE APP, THE t2509/t2517 BAR: feature_canvas + radial_handle authored via REAL palette drags, real field edits, real save, a REAL reload, then a REAL mouse drag on the rendered SVG handle writes the field', async ({ page }) => {
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
    async function dragFlyoutBlockToMouth(type, mouthPt) {
        const grab = await flyoutBlockCenter(type);
        const off = await flyoutDragOffset(type);
        const dropX = mouthPt.x + off.dx, dropY = mouthPt.y + off.dy;
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
    async function centerOn(blockType) {
        await page.evaluate((t) => { const ws = window.__blkws; const blk = ws.getAllBlocks(false).find((b) => b.type === t); if (blk) ws.centerOnBlock(blk.id, true); }, blockType);
        await page.waitForTimeout(400);
    }
    async function fieldRect(blockType, fieldName) {
        return page.evaluate(({ blockType, fieldName }) => {
            const ws = window.__blkws;
            const blk = ws.getAllBlocks(false).find((b) => b.type === blockType);
            const f = blk.getField(fieldName);
            const group = f.fieldGroup_ || f.getSvgRoot();
            const el = (group && group.querySelector('text')) || (f.getClickTarget_ && f.getClickTarget_()) || group;
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, { blockType, fieldName });
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
        const rect = await fieldRect(blockType, fieldName);
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(150);
        await page.keyboard.press('Control+A');
        await page.keyboard.type(String(value));
        await page.keyboard.press('Tab');
        await page.waitForTimeout(150);
    }

    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    // 1) user_root onto the empty canvas
    await searchFor('Define Custom Wizard');
    const ur = await flyoutBlockCenter('user_root');
    await page.mouse.move(ur.x, ur.y);
    await page.mouse.down();
    await page.mouse.move(ur.x + 40, ur.y, { steps: 5 });
    await page.mouse.move(600, 300, { steps: 15 });
    await page.mouse.move(600, 300, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(250);

    // 2) feature_canvas into user_root's PRESENTATION mouth
    const presMouth = await mouthPoint('user_root', 'PRESENTATION');
    await searchFor('feature canvas');
    await dragFlyoutBlockToMouth('feature_canvas', presMouth);
    const fcConnected = await page.evaluate(() => {
        const ws = window.__blkws;
        const ur = ws.getAllBlocks(false).find((b) => b.type === 'user_root');
        return ur.inputList.find((i) => i.name === 'PRESENTATION').connection.targetBlock()?.type === 'feature_canvas';
    });
    expect(fcConnected, 'feature_canvas connected into user_root PRESENTATION mouth (a real drag)').toBe(true);

    // 3) radial_handle into feature_canvas's OWN mouth
    const fcMouth = await mouthPoint('feature_canvas', 'DO');
    await searchFor('radial handle');
    await dragFlyoutBlockToMouth('radial_handle', fcMouth);
    const rdhConnected = await page.evaluate(() => {
        const ws = window.__blkws;
        const fc = ws.getAllBlocks(false).find((b) => b.type === 'feature_canvas');
        const inp = fc.inputList.find((i) => i.name === 'DO');
        return !!(inp.connection.targetBlock() && inp.connection.targetBlock().type === 'radial_handle');
    });
    expect(rdhConnected, 'radial_handle connected into feature_canvas own DO mouth').toBe(true);

    // 4) real field edits: feature_canvas -> form2d; rename field to something distinctive
    await setDropdownField('feature_canvas', 'PANEL', 'form2d');
    await setTextField('radial_handle', 'FIELD', 'holedia');
    const fieldsSet = await page.evaluate(() => {
        const ws = window.__blkws;
        return {
            panel: ws.getAllBlocks(false).find((b) => b.type === 'feature_canvas').getFieldValue('PANEL'),
            field: ws.getAllBlocks(false).find((b) => b.type === 'radial_handle').getFieldValue('FIELD'),
        };
    });
    expect(fieldsSet.panel).toBe('form2d');
    expect(fieldsSet.field).toBe('holedia');

    // 5) save via the real dialog
    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 't2521 radial handle pilot (live)');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(500);

    // 6) a REAL reload -- the saved op must survive
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const savedOpType = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 't2521 radial handle pilot (live)');
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
            val: (f.querySelector('[data-param="holedia"]') || {}).value,
            svgPresent: !!svg,
            handles: svg ? svg.querySelectorAll('circle.fc-handle, rect.fc-handle, .fc-handle, [data-handle]').length : 0,
        };
    });
    expect(rendered.hasField, 'the holedia param renders a real form row').toBe(true);
    expect(rendered.svgPresent, 'the 2D FeatureCanvas SVG renders').toBe(true);
    expect(rendered.handles, 'at least one interactive handle renders on the canvas').toBeGreaterThan(0);

    // 7) THE REAL GESTURE: a mouse drag on the rendered SVG handle
    const handleRect = await page.evaluate(() => {
        const svg = document.getElementById('userVizContainer').querySelector('svg');
        const h = svg.querySelector('circle.fc-handle, rect.fc-handle, .fc-handle, [data-handle]');
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

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2521-radial-handle-live-drag.png', clip: _b }); }

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, savedOpType);

    expect(before, 'holedia starts at the authored default').toBe('20');
    expect(after, 'a REAL mouse drag on the SVG handle changed holedia (assert-the-value)').not.toBe(before);
});
