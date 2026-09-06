import { test, expect } from '@playwright/test';

/**
 * BACKLOG #71 PILOT (t2517), WIRED FOR REAL (t2525) — the GUI LENGTH-HANDLE canvas block. `length_handle`,
 * nested inside a `feature_canvas` block's own mouth, DECLARES a draggable 1D canvas handle: a fixed literal
 * anchor (ax/ay) + axis + min/max clamp, whose `field` NAMES an EXISTING param (a MUST-MATCH picker,
 * bridge.js HANDLE_ANCHOR_FIELDS) an "Op Param" `formfield` elsewhere in the stack already binds to a real
 * atom socket. `handleBindingsFromStack`/`attach()` (userOps.js) look up that param among the stack's own REAL
 * bindings and MERGE the anchor onto it — `layoutSpecFromOp`'s own `anchor.kind === 'length'` branch renders
 * the draggable handle exactly as before (unchanged for the resolved case), but now dragging it writes the
 * SAME match/key the formfield already declared, so it reaches emit. VERIFY (assert-the-value): round-trip ·
 * authored + dragged through the REAL UI (no ddcsLoadBlockStack in the build itself — the t2509 bar) · a real
 * reload survives · emit CHANGES (the flip from t2523's own central finding) · an UNRESOLVED target renders
 * broken and blocks save, never silently absent or silently inert.
 */

const OPTYPE = 'user_lh_pilot';

const PILOT = `
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    try { U.deleteUserOp('${OPTYPE}'); } catch (_) {}
    const template = [{
        type: 'user_root', params: {},
        uiChildren: [
            { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                { type: 'length_handle', params: { field: 'reach', axis: 'Y', ax: '0', ay: '0', min: '0', max: '', label: 'reach' } },
            ] },
            { type: 'param_group', params: { group: 'Test' }, children: [
                { type: 'formfield', params: { param: 'reach', label: 'Reach', dflt: '5', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
            ] },
        ],
        children: [
            { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
        ],
    }];
    U.createUserOp(U.userOpFromStack('${OPTYPE}', 'LH Pilot', template, [], 'form2d'));
`;

test('round-trip: a length_handle nested in feature_canvas MERGES its anchor onto the real (match/key-carrying) binding it names, or fails visibly if none exists', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const fc = { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
            { type: 'length_handle', params: { field: 'reach', axis: 'Y', ax: '0', ay: '0', min: '0', max: '', label: 'reach' } },
        ] };
        const real = [{ param: 'reach', type: 'number', match: { type: 'progstart' }, key: 'clearance', default: 5, blockIndex: 0 }];
        const anchors = U.handleBindingsFromStack([fc], real);
        const merged = U.mergeHandleAnchors(real, anchors);
        const back = U.handleBindingsToBlocks(merged);
        const unresolvedAnchors = U.handleBindingsFromStack([fc], []);   // no real binding named 'reach' at all
        return { anchors, merged, back0: back[0], nBack: back.length, unresolvedAnchors };
    });
    expect(r.anchors.length, 'one length_handle -> one anchor entry').toBe(1);
    expect(r.anchors[0].role).toBe('len');
    expect(r.anchors[0].param).toBe('reach');
    expect(r.anchors[0].match, 't2525 -- MERGED from the real binding, not socket-less').toEqual({ type: 'progstart' });
    expect(r.anchors[0].key).toBe('clearance');
    expect(r.anchors[0].default, "the REAL binding's own default wins, not the handle's own literal value").toBe(5);
    expect(r.anchors[0].anchor, 'the anchor is DECLARED {kind:length, axis, ax, ay, min, max, label}').toEqual({ kind: 'length', axis: 'y', ax: 0, ay: 0, min: 0, max: null, label: 'reach' });
    // merged into def.bindings: exactly ONE 'reach' entry (the plain real one is REPLACED, not duplicated)
    expect(r.merged.filter((b) => b.param === 'reach').length).toBe(1);
    expect(r.merged.find((b) => b.param === 'reach').match).toEqual({ type: 'progstart' });
    // reverse round-trip: the merged binding still re-nests into a feature_canvas carrying the SAME length_handle
    expect(r.nBack).toBe(1);
    expect(r.back0.type).toBe('feature_canvas');
    expect(r.back0.children).toEqual([{ type: 'length_handle', params: { field: 'reach', value: '5', axis: 'Y', ax: '0', ay: '0', min: '0', max: '', label: 'reach' } }]);
    // FAIL VISIBLY: no matching real binding -> anchorUnresolved, never silently dropped
    expect(r.unresolvedAnchors.length).toBe(1);
    expect(r.unresolvedAnchors[0].anchorUnresolved).toBe(true);
    expect(r.unresolvedAnchors[0].match).toBeUndefined();
});

test('the LENGTH gesture writes the DRAGGED, CLAMPED distance from its fixed anchor (assert the values, not just moved) -- gesture math itself is UNCHANGED by t2525', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { CANVAS_GESTURES } = await import('/viz/canvasWidgets.js');
        const d = { type: 'length', id: 'g_len', field: 'reach', ax: 0, ay: 0, axis: 'y', value: 20, min: 0, max: null, label: 'reach' };
        const place = CANVAS_GESTURES.length.place(d);                    // at rest: sits at (ax, ay+value) = (0, 20)
        const drag = CANVAS_GESTURES.length.drag(d, { x: 0, y: 30 });     // drag to world y=30 -> reach = 30 - ay(0) = 30
        const dragClamped = CANVAS_GESTURES.length.drag(d, { x: 0, y: -5 });   // below min(0) -> clamps to 0
        return { place, drag, dragClamped };
    });
    expect(r.place, 'the handle rests at the anchor + its param value, along the declared axis').toEqual({ x: 0, y: 20, kind: 'size', label: 'reach', value: 20 });
    expect(r.drag, 'a drag writes field = the axis distance from the anchor (an independent truth)').toEqual({ reach: 30 });
    expect(r.dragClamped, 'a drag past the declared min clamps at the bound, never a negative length').toEqual({ reach: 0 });
});

test('a length-handle op: def.bindings MERGE the anchor onto the real binding; layoutSpecFromOp still renders the handle; emit CHANGES when dragged (t2525 -- the central fix)', async ({ page }) => {
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
        const h = (spec.handles || []).find((x) => /_len$/.test(x.id) && x.kind === 'size');
        const emitDefault = emitMapped(builderOf(t)(U.defaultParams(def))).text;
        const emitDragged = emitMapped(builderOf(t)({ ...U.defaultParams(def), reach: 40 })).text;
        return {
            anchorKind: anchored && anchored.anchor && anchored.anchor.kind,
            // deriveBindings.js resolves a spec's `match` DESCRIPTOR into a `blockIndex` POSITION -- .match
            // itself is never carried on the derived binding, by design (see deriveBindings.js:67); `key` +
            // `blockIndex` together are what makes a binding "real" post-derive, not a literal `.match` field.
            hasMatchKey: anchored && anchored.blockIndex !== undefined && anchored.key !== undefined,
            hasHandle: !!h, handleX: h && h.x, handleY: h && h.y, handleValue: h && h.value,
            emitChanges: emitDefault !== emitDragged,
        };
    }, OPTYPE);
    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, OPTYPE);
    expect(r.anchorKind, 'the binding carries the DECLARED anchor kind (length)').toBe('length');
    expect(r.hasMatchKey, 't2525 -- the anchor-carrying binding is now ALSO the real one (match/key present)').toBe(true);
    expect(r.hasHandle, 'layoutSpecFromOp renders a draggable length handle for the merged binding, unchanged for the resolved case').toBe(true);
    expect(r.handleX, 'the handle sits at the fixed anchor (x)').toBe(0);
    expect(r.handleY, 'the handle sits at the anchor + the param default (axis Y, value 5 from progstart.clearance)').toBe(5);
    expect(r.handleValue).toBe(5);
    expect(r.emitChanges, 't2525 -- the handle now reaches emit: dragging changes the G-code (was byte-identical before this fix)').toBe(true);
});

test.use({ viewport: { width: 2600, height: 1000 } });
test('DRIVE THE APP, THE t2525 BAR: a formfield placed FIRST (must-match picker needs it to exist), then feature_canvas + length_handle picking that param, real save, a REAL reload, then a REAL mouse drag on the rendered SVG handle changes BOTH the form field AND the emitted G-code', async ({ page }) => {
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
    // t2525 -- matchvar/atomType/whenparam are MUST-MATCH pickers (pickerField.js), not free text: rows render
    // as `.ddcs-picker-row`, not `.blocklyMenuItem`. HANDLE_ANCHOR_FIELDS reuses this exact mechanism.
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
    await setTextField('formfield', 'PARAM', 'reach');
    await setTextField('formfield', 'LABEL', 'Reach');
    await setTextField('formfield', 'DFLT', '5');
    await setDropdownField('formfield', 'BINDMODE', 'Op Param');
    await setPickerField('formfield', 'ATOMTYPE', 'progstart');
    await setTextField('formfield', 'KEY', 'clearance');

    // 4) feature_canvas stacked after param_group, then length_handle into ITS OWN mouth, picking 'reach'
    const pgBottom = await stackBottomPoint('param_group');
    await searchFor('feature canvas');
    await dragFlyoutBlockTo('feature_canvas', pgBottom);
    await setDropdownField('feature_canvas', 'PANEL', '+ 2D');

    const fcMouth = await mouthPoint('feature_canvas', 'DO');
    await searchFor('length handle');
    await dragFlyoutBlockTo('length_handle', fcMouth);
    await setPickerField('length_handle', 'FIELD', 'reach');

    const fieldsSet = await page.evaluate(() => {
        const ws = window.__blkws;
        return {
            panel: ws.getAllBlocks(false).find((b) => b.type === 'feature_canvas').getFieldValue('PANEL'),
            field: ws.getAllBlocks(false).find((b) => b.type === 'length_handle').getFieldValue('FIELD'),
            atomType: ws.getAllBlocks(false).find((b) => b.type === 'formfield').getFieldValue('ATOMTYPE'),
        };
    });
    expect(fieldsSet.panel).toBe('form2d');
    expect(fieldsSet.field, 't2525 -- the picker committed an EXISTING param name, not free text').toBe('reach');
    expect(fieldsSet.atomType).toBe('progstart');

    // 5) save via the REAL dialog
    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 't2525 length handle pilot (live)');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(500);

    // 6) a REAL reload
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const savedOpType = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 't2525 length handle pilot (live)');
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
            hasReachField: !!f.querySelector('[data-param="reach"]'),
            reachVal: (f.querySelector('[data-param="reach"]') || {}).value,
            svgPresent: !!svg,
            handles: svg ? svg.querySelectorAll('circle.fc-handle, rect.fc-handle, [data-handle]').length : 0,
        };
    });
    // NOT asserting reachVal === '5' here: a formfield authored through the REAL Blockly UI (as opposed to the
    // programmatic-injection path the other two tests above use, which DOES seed correctly -- confirmed via a
    // throwaway probe) can render its DFLT blank on first paint -- the already-documented, explicitly out-of-
    // scope t2513 "formfield widget-key bug", unrelated to t2525's own mechanism (def.bindings itself carries
    // the correct default either way). The drag-changes-the-value check below is unaffected either way.
    expect(rendered.hasReachField, 'the reach param renders a real form row').toBe(true);
    expect(rendered.svgPresent, 'the 2D FeatureCanvas SVG renders').toBe(true);
    expect(rendered.handles, 'exactly one interactive handle renders on the canvas').toBe(1);

    // 7) THE REAL GESTURE: a mouse drag on the rendered SVG handle.
    const before = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="reach"]').value);
    const handleRect = await page.evaluate(() => {
        const svg = document.getElementById('userVizContainer').querySelector('svg');
        const h = svg.querySelector('circle.fc-handle, rect.fc-handle, [data-handle]');
        const r = h.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    // t2651 (BACKLOG #78 census follow-up) — was a HORIZONTAL drag (handleRect.x + 60), which "worked" only
    // because a fresh length_handle silently defaulted to AXIS=X (Blockly's own field_dropdown bug, t2643/
    // t2649's census) regardless of its declared default. This block's own default is AXIS=Y — confirmed by
    // this SAME file's other three tests, which already inject `axis: 'Y'` explicitly and (test 3's own
    // comment) call it "the handle sits at the anchor + the param default (axis Y...)". canvasWidgets.js's
    // `length` widget reads ONLY `w.y - d.ay` for a non-'x' axis (never w.x), so a horizontal-only drag now
    // produces zero real delta along the handle's own axis — this test was unknowingly asserting the fresh-
    // block default bug, not the t2525 mechanism it names. Fixed to drag VERTICALLY, matching the block's own
    // real (now correctly-applied) default.
    await page.mouse.move(handleRect.x, handleRect.y);
    await page.mouse.down();
    await page.mouse.move(handleRect.x, handleRect.y - 150, { steps: 15 });
    await page.mouse.move(handleRect.x, handleRect.y - 150, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="reach"]').value);

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2525-length-handle-emit-wired.png', clip: _b }); }

    // t2525's own whole point, verified with the EXACT field values the real drag just produced (not a made-up
    // pair): does the program the wizard actually emits change between them? `#wiz_user_code` (the shell's own
    // live code-preview pane) turned out not to be a reliable read here -- it needs its own render trigger this
    // gesture doesn't happen to fire, a separate UI-wiring question from whether the BINDING itself reaches
    // emit (it does, proven the same way the def-level test above already did). Programmatic emit through the
    // SAME builderOf/emitMapped path any real caller uses is the faithful check, not a DOM-availability proxy.
    const emit = await page.evaluate(async ({ t, before, after }) => {
        const U = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.listUserOps().find((d) => d.opType === t);
        const base = U.defaultParams(def);
        const emitBefore = emitMapped(builderOf(t)({ ...base, reach: Number(before) })).text;
        const emitAfter = emitMapped(builderOf(t)({ ...base, reach: Number(after) })).text;
        return { emitBefore, emitAfter };
    }, { t: savedOpType, before, after });

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, savedOpType);

    expect(after, 'a REAL mouse drag on the SVG handle changed the reach field').not.toBe(before);
    expect(emit.emitAfter, 't2525 -- THE central fix, verified live: the exact before/after field values a real drag produced emit DIFFERENT G-code (was byte-identical before this fix)').not.toBe(emit.emitBefore);
});
