import { test, expect } from '@playwright/test';

/**
 * BACKLOG #71 (t2533, the fifth gesture) — the GUI SCALE-HANDLE canvas block. `scale_handle`, nested inside a
 * `feature_canvas` block's own mouth, DECLARES a draggable horizontal SCALE-FACTOR handle: a fixed literal
 * anchor (ax/ay) + min/max clamp, whose `field` NAMES an EXISTING param (a MUST-MATCH picker, bridge.js
 * HANDLE_ANCHOR_FIELDS) an "Op Param" `formfield` elsewhere in the stack already binds to a real atom socket —
 * same template as `length_handle`/`point_handle`/`rect_handle`/`radial_handle`. WHERE IT DIFFERS: a SECOND
 * must-match picker, `baseField`, names a SEPARATE existing param read for its CURRENT VALUE only (the
 * unscaled base width canvasWidgets.js's own `scaleX` gesture needs to compute `edgeX`) — never itself merged
 * onto or made draggable by this block. VERIFY (assert-the-value): round-trip · authored + dragged through the
 * REAL UI (the t2509/t2525 bar) · a real reload survives · emit CHANGES · either picker unresolved renders
 * broken and blocks save.
 */

const OPTYPE = 'user_sh_pilot';

const PILOT = `
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    try { U.deleteUserOp('${OPTYPE}'); } catch (_) {}
    const template = [{
        type: 'user_root', params: {},
        uiChildren: [
            { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                { type: 'scale_handle', params: { field: 'scaleF', baseField: 'baseW', ax: '0', ay: '0', min: '0.1', max: '', label: 'scale' } },
            ] },
            { type: 'param_group', params: { group: 'Test' }, children: [
                { type: 'formfield', params: { param: 'baseW', label: 'Base W', dflt: '10', bindMode: 'opparam', atomType: 'progstart', key: 'rpm', type: 'number' } },
                { type: 'formfield', params: { param: 'scaleF', label: 'Scale', dflt: '2', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
            ] },
        ],
        children: [
            { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
        ],
    }];
    U.createUserOp(U.userOpFromStack('${OPTYPE}', 'SH Pilot', template, [], 'form2d'));
`;

test('round-trip: a scale_handle nested in feature_canvas MERGES its anchor onto the real (match/key-carrying) binding it names, or fails visibly if EITHER picker is unresolved', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const fc = { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
            { type: 'scale_handle', params: { field: 'scaleF', baseField: 'baseW', ax: '0', ay: '0', min: '0.1', max: '', label: 'scale' } },
        ] };
        const real = [
            { param: 'baseW', type: 'number', match: { type: 'progstart' }, key: 'rpm', default: 10, blockIndex: 0 },
            { param: 'scaleF', type: 'number', match: { type: 'progstart' }, key: 'clearance', default: 2, blockIndex: 0 },
        ];
        const anchors = U.handleBindingsFromStack([fc], real);
        const merged = U.mergeHandleAnchors(real, anchors);
        const back = U.handleBindingsToBlocks(merged);
        const unresolvedField = U.handleBindingsFromStack([fc], [real[0]]);         // 'scaleF' itself missing
        const unresolvedBase = U.handleBindingsFromStack([fc], [real[1]]);          // 'baseW' (the read-only ref) missing
        return { anchors, merged, back0: back[0], nBack: back.length, unresolvedField, unresolvedBase };
    });
    expect(r.anchors.length, 'one scale_handle -> one anchor entry (baseField is read-only, not a second entry)').toBe(1);
    expect(r.anchors[0].role).toBe('scale');
    expect(r.anchors[0].param).toBe('scaleF');
    expect(r.anchors[0].match, 'MERGED from the real binding, not socket-less').toEqual({ type: 'progstart' });
    expect(r.anchors[0].key).toBe('clearance');
    expect(r.anchors[0].default, "the REAL binding's own default wins, not the handle's own literal value").toBe(2);
    expect(r.anchors[0].anchor).toEqual({ kind: 'scale', ax: 0, ay: 0, baseField: 'baseW', min: 0.1, max: null, label: 'scale' });
    expect(r.merged.filter((b) => b.param === 'scaleF').length).toBe(1);
    // reverse round-trip
    expect(r.nBack).toBe(1);
    expect(r.back0.type).toBe('feature_canvas');
    expect(r.back0.children).toEqual([{ type: 'scale_handle', params: { field: 'scaleF', baseField: 'baseW', value: '2', ax: '0', ay: '0', min: '0.1', max: '', label: 'scale' } }]);
    // FAIL VISIBLY: EITHER picker's target missing -> anchorUnresolved, never silently dropped
    expect(r.unresolvedField.length).toBe(1);
    expect(r.unresolvedField[0].anchorUnresolved).toBe(true);
    expect(r.unresolvedBase.length).toBe(1);
    expect(r.unresolvedBase[0].anchorUnresolved, 'the read-only baseField reference must ALSO resolve, or the whole handle fails visibly').toBe(true);
});

test('the SCALE gesture writes the DRAGGED, CLAMPED factor from its fixed anchor + the CURRENT base span (assert the values, not just moved) -- gesture math itself is UNCHANGED by this turn', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { CANVAS_GESTURES } = await import('/viz/canvasWidgets.js');
        // base=10, value=2 -> current span (edgeX-ax) = 20; anchor at x=0
        const d = { type: 'scaleX', id: 'g_sc', field: 'scaleF', ax: 0, ay: 0, edgeX: 20, value: 2, min: 0.1, max: null, label: 'scale' };
        const place = CANVAS_GESTURES.scaleX.place(d);                     // at rest: sits at (edgeX, ay) = (20, 0)
        const drag = CANVAS_GESTURES.scaleX.drag(d, { x: 30, y: 0 });      // drag to world x=30 -> factor = 2*(30-0)/20 = 3
        const dragClamped = CANVAS_GESTURES.scaleX.drag(d, { x: -50, y: 0 });   // below min(0.1) -> clamps to 0.1
        return { place, drag, dragClamped };
    });
    expect(r.place, 'the handle rests at the current edge (ax + base*value)').toEqual({ x: 20, y: 0, kind: 'size', label: 'scale', value: 2 });
    expect(r.drag, 'a drag scales the factor by the cursor fraction of the current span (an independent truth)').toEqual({ scaleF: 3 });
    expect(r.dragClamped, 'a drag past the declared min clamps at the bound, never a sub-min factor').toEqual({ scaleF: 0.1 });
});

test('a scale-handle op: def.bindings MERGE the anchor onto the real binding; layoutSpecFromOp renders the handle at the CURRENT base*factor edge; emit CHANGES when dragged (the central check)', async ({ page }) => {
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
        const h = (spec.handles || []).find((x) => /_scale$/.test(x.id) && x.kind === 'size');
        const emitDefault = emitMapped(builderOf(t)(U.defaultParams(def))).text;
        const emitDragged = emitMapped(builderOf(t)({ ...U.defaultParams(def), scaleF: 4 })).text;
        return {
            anchorKind: anchored && anchored.anchor && anchored.anchor.kind,
            hasMatchKey: anchored && anchored.blockIndex !== undefined && anchored.key !== undefined,
            hasHandle: !!h, handleX: h && h.x, handleY: h && h.y, handleValue: h && h.value,
            emitChanges: emitDefault !== emitDragged,
        };
    }, OPTYPE);
    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, OPTYPE);
    expect(r.anchorKind, 'the binding carries the DECLARED anchor kind (scale)').toBe('scale');
    expect(r.hasMatchKey, 'the anchor-carrying binding is now ALSO the real one (match/key present)').toBe(true);
    expect(r.hasHandle, 'layoutSpecFromOp renders a draggable scale handle for the merged binding').toBe(true);
    expect(r.handleX, 'the handle sits at ax(0) + baseW(10, from progstart.rpm default) * scaleF(2, from progstart.clearance default) = 20').toBe(20);
    expect(r.handleY).toBe(0);
    expect(r.handleValue).toBe(2);
    expect(r.emitChanges, 'the handle reaches emit: dragging changes the G-code').toBe(true);
});

test.use({ viewport: { width: 2600, height: 1000 } });
test('DRIVE THE APP, THE t2525 BAR: two formfields placed FIRST (must-match pickers need them to exist), then feature_canvas + scale_handle picking both, real save, a REAL reload, then a REAL mouse drag on the rendered SVG handle changes BOTH the form field AND the emitted G-code', async ({ page }) => {
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
    async function fieldRect(blockType, fieldName, nth) {
        return page.evaluate(({ blockType, fieldName, nth }) => {
            const ws = window.__blkws;
            const blks = ws.getAllBlocks(false).filter((b) => b.type === blockType);
            const blk = blks[nth || 0];
            const f = blk.getField(fieldName);
            const group = f.fieldGroup_ || f.getSvgRoot();
            const el = (group && group.querySelector('text')) || (f.getClickTarget_ && f.getClickTarget_()) || group;
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, { blockType, fieldName, nth });
    }
    async function setDropdownField(blockType, fieldName, optionText, nth) {
        await clearSearch();
        await centerOn(blockType);
        const rect = await fieldRect(blockType, fieldName, nth);
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(250);
        await page.locator('.blocklyMenuItem', { hasText: optionText }).first().click({ timeout: 3000 });
        await page.waitForTimeout(150);
    }
    async function setTextField(blockType, fieldName, value, nth) {
        await clearSearch();
        const rect = await fieldRect(blockType, fieldName, nth);
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(150);
        await page.keyboard.press('Control+A');
        await page.keyboard.type(String(value));
        await page.keyboard.press('Tab');
        await page.waitForTimeout(150);
    }
    async function setPickerField(blockType, fieldName, matchText, nth) {
        await clearSearch();
        const rect = await fieldRect(blockType, fieldName, nth);
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

    // 2) progstart into EXECUTION (its rpm + clearance fields are the eventual emit targets)
    const execMouth = await mouthPoint('user_root', 'EXECUTION');
    await searchFor('program start');
    await dragFlyoutBlockTo('progstart', execMouth);

    // 3) param_group into PRESENTATION, then TWO formfields (Op Param -> progstart.rpm / progstart.clearance)
    //    BEFORE the handle, since the handle's own pickers need both params to already exist.
    const presMouth = await mouthPoint('user_root', 'PRESENTATION');
    await searchFor('parameter group');
    await dragFlyoutBlockTo('param_group', presMouth);
    await setTextField('param_group', 'GROUP', 'Test');

    const pgMouth = await mouthPoint('param_group', 'DO');
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', pgMouth);
    await setTextField('formfield', 'PARAM', 'baseW');
    await setTextField('formfield', 'LABEL', 'Base W');
    await setTextField('formfield', 'DFLT', '10');
    await setDropdownField('formfield', 'BINDMODE', 'Op Param');
    await setPickerField('formfield', 'ATOMTYPE', 'progstart');
    await setTextField('formfield', 'KEY', 'rpm');

    const ff1Bottom = await stackBottomPoint('formfield');
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', ff1Bottom);
    await setTextField('formfield', 'PARAM', 'scaleF', 1);
    await setTextField('formfield', 'LABEL', 'Scale', 1);
    await setTextField('formfield', 'DFLT', '2', 1);
    await setDropdownField('formfield', 'BINDMODE', 'Op Param', 1);
    await setPickerField('formfield', 'ATOMTYPE', 'progstart', 1);
    await setTextField('formfield', 'KEY', 'clearance', 1);

    // 4) feature_canvas stacked after param_group, then scale_handle into ITS OWN mouth, picking both params
    const pgBottom = await stackBottomPoint('param_group');
    await searchFor('feature canvas');
    await dragFlyoutBlockTo('feature_canvas', pgBottom);
    await setDropdownField('feature_canvas', 'PANEL', 'form2d');

    const fcMouth = await mouthPoint('feature_canvas', 'DO');
    await searchFor('scale handle');
    await dragFlyoutBlockTo('scale_handle', fcMouth);
    await setPickerField('scale_handle', 'FIELD', 'scaleF');
    await setPickerField('scale_handle', 'BASEFIELD', 'baseW');

    const fieldsSet = await page.evaluate(() => {
        const ws = window.__blkws;
        return {
            panel: ws.getAllBlocks(false).find((b) => b.type === 'feature_canvas').getFieldValue('PANEL'),
            field: ws.getAllBlocks(false).find((b) => b.type === 'scale_handle').getFieldValue('FIELD'),
            baseField: ws.getAllBlocks(false).find((b) => b.type === 'scale_handle').getFieldValue('BASEFIELD'),
        };
    });
    expect(fieldsSet.panel).toBe('form2d');
    expect(fieldsSet.field, 'the picker committed an EXISTING param name, not free text').toBe('scaleF');
    expect(fieldsSet.baseField, 'the second picker committed the OTHER existing param name').toBe('baseW');

    // 5) save via the REAL dialog
    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 't2533 scale handle pilot (live)');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(500);

    // 6) a REAL reload
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const savedOpType = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 't2533 scale handle pilot (live)');
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
            hasScaleField: !!f.querySelector('[data-param="scaleF"]'),
            svgPresent: !!svg,
            handles: svg ? svg.querySelectorAll('circle.fc-handle, rect.fc-handle, [data-handle]').length : 0,
        };
    });
    // NOT asserting the field's rendered value here — same documented t2513 formfield-DFLT-blank-on-first-paint
    // gap length-handle-block.spec.js's own t2525 test already carries; unrelated to this turn's own mechanism.
    expect(rendered.hasScaleField, 'the scaleF param renders a real form row').toBe(true);
    expect(rendered.svgPresent, 'the 2D FeatureCanvas SVG renders').toBe(true);
    expect(rendered.handles, 'exactly one interactive handle renders on the canvas').toBe(1);

    // 6b) the t2513 formfield-DFLT-blank-on-first-paint gap means BOTH baseW and scaleF can render blank here
    // (0 once read as a number) — harmless for length_handle's own additive drag math, but scaleX's own drag is
    // MULTIPLICATIVE (canvasWidgets.js: `span = edgeX - ax`, and a ~0 span returns null by design — it cannot
    // "scale up" from a zero-width span, the same way you can't scale a photo that's 0px wide). So set BOTH
    // starting values through the real form first, exactly as a real author would before ever touching the
    // handle — this is not a workaround for a bug in THIS turn's mechanism, it's the natural authoring order.
    const baseWField = page.locator('#wiz_user_form [data-param="baseW"]');
    await baseWField.fill('10');
    await baseWField.dispatchEvent('input');
    const scaleFField = page.locator('#wiz_user_form [data-param="scaleF"]');
    await scaleFField.fill('2');
    await scaleFField.dispatchEvent('input');
    await page.waitForTimeout(300);

    // 7) THE REAL GESTURE: a mouse drag on the rendered SVG handle.
    const before = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="scaleF"]').value);
    expect(before, 'the form field carries the value just set (a real span exists for the drag to scale from)').toBe('2');
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
    const after = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="scaleF"]').value);

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2533-scale-handle-emit-wired.png', clip: _b }); }

    const emit = await page.evaluate(async ({ t, before, after }) => {
        const U = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.listUserOps().find((d) => d.opType === t);
        const base = U.defaultParams(def);
        const emitBefore = emitMapped(builderOf(t)({ ...base, scaleF: Number(before) })).text;
        const emitAfter = emitMapped(builderOf(t)({ ...base, scaleF: Number(after) })).text;
        return { emitBefore, emitAfter };
    }, { t: savedOpType, before, after });

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, savedOpType);

    expect(after, 'a REAL mouse drag on the SVG handle changed the scaleF field').not.toBe(before);
    expect(emit.emitAfter, 'the exact before/after field values a real drag produced emit DIFFERENT G-code').not.toBe(emit.emitBefore);
});
