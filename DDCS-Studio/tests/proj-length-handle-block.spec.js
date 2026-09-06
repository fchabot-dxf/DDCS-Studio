import { test, expect } from '@playwright/test';

/**
 * BACKLOG #71 (t2533, the seventh gesture) — the GUI PROJ-LENGTH-HANDLE canvas block. `proj_length_handle`,
 * nested inside a `feature_canvas` block's own mouth, DECLARES a draggable SYMMETRIC-EXTENT handle: a fixed
 * centre (cx/cy) + a cardinal axis + min/max clamp, whose `field` NAMES an EXISTING param (a MUST-MATCH
 * picker, bridge.js HANDLE_ANCHOR_FIELDS) an "Op Param" `formfield` elsewhere in the stack already binds — same
 * template as `length_handle`/`point_handle`/`rect_handle`/`radial_handle`. SIMPLER than `scale_handle`/
 * `shear_handle`: canvasWidgets.js's own `off` (the current half-extent) SELF-DERIVES from this same field's
 * value (`off = value/scale`) — no second, read-only companion param needed. VERIFY (assert-the-value):
 * round-trip · authored + dragged through the REAL UI (the t2509/t2525 bar) · a real reload survives · emit
 * CHANGES · an UNRESOLVED target renders broken and blocks save.
 */

const OPTYPE = 'user_pl_pilot';

const PILOT = `
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    try { U.deleteUserOp('${OPTYPE}'); } catch (_) {}
    const template = [{
        type: 'user_root', params: {},
        uiChildren: [
            { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                { type: 'proj_length_handle', params: { field: 'width', axis: 'X', cx: '0', cy: '0', scale: '2', min: '1', max: '', label: 'width' } },
            ] },
            { type: 'param_group', params: { group: 'Test' }, children: [
                { type: 'formfield', params: { param: 'width', label: 'Width', dflt: '20', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
            ] },
        ],
        children: [
            { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
        ],
    }];
    U.createUserOp(U.userOpFromStack('${OPTYPE}', 'PL Pilot', template, [], 'form2d'));
`;

test('round-trip: a proj_length_handle nested in feature_canvas MERGES its anchor onto the real (match/key-carrying) binding it names, or fails visibly if none exists', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const fc = { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
            { type: 'proj_length_handle', params: { field: 'width', axis: 'X', cx: '0', cy: '0', scale: '2', min: '1', max: '', label: 'width' } },
        ] };
        const real = [{ param: 'width', type: 'number', match: { type: 'progstart' }, key: 'clearance', default: 20, blockIndex: 0 }];
        const anchors = U.handleBindingsFromStack([fc], real);
        const merged = U.mergeHandleAnchors(real, anchors);
        const back = U.handleBindingsToBlocks(merged);
        const unresolvedAnchors = U.handleBindingsFromStack([fc], []);   // no real binding named 'width' at all
        return { anchors, merged, back0: back[0], nBack: back.length, unresolvedAnchors };
    });
    expect(r.anchors.length, 'one proj_length_handle -> one anchor entry').toBe(1);
    expect(r.anchors[0].role).toBe('plen');
    expect(r.anchors[0].param).toBe('width');
    expect(r.anchors[0].match, 'MERGED from the real binding, not socket-less').toEqual({ type: 'progstart' });
    expect(r.anchors[0].key).toBe('clearance');
    expect(r.anchors[0].default, "the REAL binding's own default wins, not the handle's own literal value").toBe(20);
    expect(r.anchors[0].anchor).toEqual({ kind: 'projLength', cx: 0, cy: 0, nx: 1, ny: 0, scale: 2, min: 1, max: null, label: 'width' });
    expect(r.merged.filter((b) => b.param === 'width').length).toBe(1);
    // reverse round-trip
    expect(r.nBack).toBe(1);
    expect(r.back0.type).toBe('feature_canvas');
    expect(r.back0.children).toEqual([{ type: 'proj_length_handle', params: { field: 'width', value: '20', axis: 'X', cx: '0', cy: '0', scale: '2', min: '1', max: '', label: 'width' } }]);
    // FAIL VISIBLY: no matching real binding -> anchorUnresolved, never silently dropped
    expect(r.unresolvedAnchors.length).toBe(1);
    expect(r.unresolvedAnchors[0].anchorUnresolved).toBe(true);
});

test('the PROJ-LENGTH gesture writes the DRAGGED, CLAMPED, scale-mapped ABSOLUTE distance from its fixed centre (assert the values, not just moved) -- gesture math itself is UNCHANGED by this turn', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { CANVAS_GESTURES } = await import('/viz/canvasWidgets.js');
        const d = { type: 'projLength', id: 'g_pl', field: 'width', cx: 0, cy: 0, nx: 1, ny: 0, off: 10, scale: 2, min: 1, max: null, label: 'width' };
        const place = CANVAS_GESTURES.projLength.place(d);                    // at rest: centre + nx*off = (10, 0)
        const drag = CANVAS_GESTURES.projLength.drag(d, { x: 15, y: 0 });     // drag to world (15,0) -> |15|*2 = 30
        const dragClamped = CANVAS_GESTURES.projLength.drag(d, { x: 0.3, y: 0 });   // |0.3|*2=0.6, below min(1) -> clamps to 1
        return { place, drag, dragClamped };
    });
    expect(r.place, 'the handle rests at the centre + off along the cardinal axis').toEqual({ x: 10, y: 0, kind: 'size', label: 'width', value: undefined });
    expect(r.drag, 'a drag writes field = |projected distance| * scale (an independent truth)').toEqual({ width: 30 });
    expect(r.dragClamped, 'a drag below the declared min clamps at the bound').toEqual({ width: 1 });
});

test('a proj-length-handle op: def.bindings MERGE the anchor onto the real binding; layoutSpecFromOp renders the handle at centre + value/scale; emit CHANGES when dragged (the central check)', async ({ page }) => {
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
        const h = (spec.handles || []).find((x) => /_proj$/.test(x.id) && x.kind === 'size');
        const emitDefault = emitMapped(builderOf(t)(U.defaultParams(def))).text;
        const emitDragged = emitMapped(builderOf(t)({ ...U.defaultParams(def), width: 40 })).text;
        return {
            anchorKind: anchored && anchored.anchor && anchored.anchor.kind,
            hasMatchKey: anchored && anchored.blockIndex !== undefined && anchored.key !== undefined,
            hasHandle: !!h, handleX: h && h.x, handleY: h && h.y, handleValue: h && h.value,
            emitChanges: emitDefault !== emitDragged,
        };
    }, OPTYPE);
    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, OPTYPE);
    expect(r.anchorKind, 'the binding carries the DECLARED anchor kind (projLength)').toBe('projLength');
    expect(r.hasMatchKey, 'the anchor-carrying binding is now ALSO the real one (match/key present)').toBe(true);
    expect(r.hasHandle, 'layoutSpecFromOp renders a draggable proj-length handle for the merged binding').toBe(true);
    expect(r.handleX, "the handle sits at cx(0) + width(20, from the formfield's own dflt)/scale(2) = 10").toBe(10);
    expect(r.handleY).toBe(0);
    expect(r.handleValue).toBe(20);
    expect(r.emitChanges, 'the handle reaches emit: dragging changes the G-code').toBe(true);
});

test.use({ viewport: { width: 2600, height: 1000 } });
test('DRIVE THE APP, THE t2525 BAR: a formfield placed FIRST (must-match picker needs it to exist), then feature_canvas + proj_length_handle picking that param, real save, a REAL reload, then a REAL mouse drag on the rendered SVG handle changes BOTH the form field AND the emitted G-code', async ({ page }) => {
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
    async function flyoutDragOffset(type, wantNext) {
        return page.evaluate(({ t, wantNext }) => {
            const ws = window.__blkws;
            const fws = ws.getToolbox().getFlyout().getWorkspace();
            const blk = fws.getAllBlocks().find((b) => b.type === t);
            const root = blk.getSvgRoot();
            const grabRect = (root.querySelector('text.blocklyText, .blocklyText') || root).getBoundingClientRect();
            const grabPt = { x: grabRect.x + grabRect.width / 2, y: grabRect.y + grabRect.height / 2 };
            const conn = wantNext ? blk.previousConnection : (blk.previousConnection || blk.outputConnection);
            if (!conn) return { dx: 0, dy: 0 };
            const off = conn.getOffsetInBlock();
            const blockRect = root.getBoundingClientRect();
            const connScreen = { x: blockRect.left + off.x * fws.scale, y: blockRect.top + off.y * fws.scale };
            return { dx: grabPt.x - connScreen.x, dy: grabPt.y - connScreen.y };
        }, { t: type, wantNext: !!wantNext });
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
    async function stackBottomPoint(blockType) {
        return page.evaluate((t) => {
            const ws = window.__blkws;
            const blk = ws.getAllBlocks(false).find((b) => b.type === t);
            const conn = blk.nextConnection;
            const off = conn.getOffsetInBlock();
            const rect = blk.getSvgRoot().getBoundingClientRect();
            return { x: rect.left + off.x * ws.scale, y: rect.top + off.y * ws.scale };
        }, blockType);
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

    // 2) progstart into EXECUTION (its own clearance field is the eventual emit target)
    const execMouth = await mouthPoint('user_root', 'EXECUTION');
    await searchFor('program start');
    await dragFlyoutBlockTo('progstart', execMouth);

    // 3) param_group into PRESENTATION, then a formfield (Op Param -> progstart.clearance) -- BEFORE the handle,
    //    since the handle's own picker needs this param to already exist.
    const presMouth = await mouthPoint('user_root', 'PRESENTATION');
    await searchFor('parameter group');
    await dragFlyoutBlockTo('param_group', presMouth);
    await setTextField('param_group', 'GROUP', 'Test');

    const pgMouth = await mouthPoint('param_group', 'DO');
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', pgMouth);
    await setTextField('formfield', 'PARAM', 'width');
    await setTextField('formfield', 'LABEL', 'Width');
    await setTextField('formfield', 'DFLT', '20');
    await setDropdownField('formfield', 'BINDMODE', 'Op Param');
    await setPickerField('formfield', 'ATOMTYPE', 'progstart');
    await setTextField('formfield', 'KEY', 'clearance');

    // 4) feature_canvas stacked after param_group, then proj_length_handle into ITS OWN mouth, picking 'width'
    const pgBottom = await stackBottomPoint('param_group');
    await searchFor('feature canvas');
    await dragFlyoutBlockTo('feature_canvas', pgBottom);
    await setDropdownField('feature_canvas', 'PANEL', '+ 2D');

    const fcMouth = await mouthPoint('feature_canvas', 'DO');
    await searchFor('proj length handle');
    await dragFlyoutBlockTo('proj_length_handle', fcMouth);
    await setPickerField('proj_length_handle', 'FIELD', 'width');

    const fieldsSet = await page.evaluate(() => {
        const ws = window.__blkws;
        return {
            panel: ws.getAllBlocks(false).find((b) => b.type === 'feature_canvas').getFieldValue('PANEL'),
            field: ws.getAllBlocks(false).find((b) => b.type === 'proj_length_handle').getFieldValue('FIELD'),
        };
    });
    expect(fieldsSet.panel).toBe('form2d');
    expect(fieldsSet.field, 'the picker committed an EXISTING param name, not free text').toBe('width');

    // 5) save via the REAL dialog
    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 't2533 proj length handle pilot (live)');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(500);

    // 6) a REAL reload
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const savedOpType = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 't2533 proj length handle pilot (live)');
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
            hasWidthField: !!f.querySelector('[data-param="width"]'),
            svgPresent: !!svg,
            handles: svg ? svg.querySelectorAll('circle.fc-handle, rect.fc-handle, [data-handle]').length : 0,
        };
    });
    expect(rendered.hasWidthField, 'the width param renders a real form row').toBe(true);
    expect(rendered.svgPresent, 'the 2D FeatureCanvas SVG renders').toBe(true);
    expect(rendered.handles, 'exactly one interactive handle renders on the canvas').toBe(1);

    // 7) THE REAL GESTURE: a mouse drag on the rendered SVG handle. Unlike scaleX, projLength's own drag is
    // an ABSOLUTE distance*scale (not proportional to the current value), so no pre-fill workaround is needed —
    // it writes a real value even starting from the t2513 formfield-DFLT-blank-on-first-paint gap.
    const before = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="width"]').value);
    const handleRect = await page.evaluate(() => {
        const svg = document.getElementById('userVizContainer').querySelector('svg');
        const h = svg.querySelector('circle.fc-handle, rect.fc-handle, [data-handle]');
        const r = h.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(handleRect.x, handleRect.y);
    await page.mouse.down();
    await page.mouse.move(handleRect.x + 60, handleRect.y, { steps: 15 });
    await page.mouse.move(handleRect.x + 60, handleRect.y, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="width"]').value);

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2533-proj-length-handle-emit-wired.png', clip: _b }); }

    const emit = await page.evaluate(async ({ t, before, after }) => {
        const U = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.listUserOps().find((d) => d.opType === t);
        const base = U.defaultParams(def);
        const emitBefore = emitMapped(builderOf(t)({ ...base, width: Number(before) })).text;
        const emitAfter = emitMapped(builderOf(t)({ ...base, width: Number(after) })).text;
        return { emitBefore, emitAfter };
    }, { t: savedOpType, before, after });

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, savedOpType);

    expect(after, 'a REAL mouse drag on the SVG handle changed the width field').not.toBe(before);
    expect(emit.emitAfter, 'the exact before/after field values a real drag produced emit DIFFERENT G-code').not.toBe(emit.emitBefore);
});
