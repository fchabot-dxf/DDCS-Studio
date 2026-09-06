import { test, expect } from '@playwright/test';

/**
 * BACKLOG #71, SECOND GESTURE (t2521), WIRED FOR REAL (t2525) — the GUI POINT-HANDLE canvas block.
 * `point_handle`, nested inside a `feature_canvas` block's own mouth, DECLARES a draggable 2D point handle at a
 * FIXED literal anchor (ax, ay), whose `fx`/`fy` NAME two EXISTING params (MUST-MATCH pickers, bridge.js
 * HANDLE_ANCHOR_FIELDS) two "Op Param" `formfield` blocks elsewhere in the stack already bind to real atom
 * sockets. `handleBindingsFromStack`/`attach()` (userOps.js) look up each and MERGE this handle's anchor onto
 * the real bindings, so dragging reaches emit through the SAME match/key the formfields already declared.
 *
 * HOW THIS DIFFERS FROM length_handle: point already had a live render branch (`anchor.kind === 'point'`,
 * panelTypes.js), reached until now only by `layoutwidget` (nested in `param_group`, always anchored at
 * {0,0} — its own `frame` field selects a coordinate FRAME, never a literal offset). Rather than declare a
 * SECOND, parallel anchor kind, this turn extended that ONE existing branch (`pos()`) to accept an optional
 * ax/ay/label — `layoutwidget`'s own behaviour is unchanged (its anchor never sets those, so the defaults
 * `(0, 0, 'pos')` apply exactly as before). Two authoring surfaces, one render mechanism.
 */

const OPTYPE = 'user_ph_pilot';

const PILOT = `
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    try { U.deleteUserOp('${OPTYPE}'); } catch (_) {}
    const template = [{
        type: 'user_root', params: {},
        uiChildren: [
            { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                { type: 'point_handle', params: { fx: 'spotx', fy: 'spoty', ax: '0', ay: '0', label: 'spot' } },
            ] },
            { type: 'param_group', params: { group: 'Test' }, children: [
                { type: 'formfield', params: { param: 'spotx', label: 'X', dflt: '5', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
                { type: 'formfield', params: { param: 'spoty', label: 'Y', dflt: '0', bindMode: 'opparam', atomType: 'progend', key: 'retractZ', type: 'number' } },
            ] },
        ],
        children: [
            { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
        ],
    }];
    U.createUserOp(U.userOpFromStack('${OPTYPE}', 'PH Pilot', template, [], 'form2d'));
`;

test('round-trip: a point_handle nested in feature_canvas MERGES its anchor onto the two real bindings it names, or fails visibly if either is missing', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const fc = { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
            { type: 'point_handle', params: { fx: 'spotx', fy: 'spoty', ax: '0', ay: '0', label: 'spot' } },
        ] };
        const real = [
            { param: 'spotx', type: 'number', match: { type: 'progstart' }, key: 'clearance', default: 5, blockIndex: 0 },
            { param: 'spoty', type: 'number', match: { type: 'progend' }, key: 'retractZ', default: 0, blockIndex: 1 },
        ];
        const anchors = U.handleBindingsFromStack([fc], real);
        const merged = U.mergeHandleAnchors(real, anchors);
        const back = U.handleBindingsToBlocks(merged);
        const unresolvedAnchors = U.handleBindingsFromStack([fc], []);   // neither target exists
        return { anchors, merged, back0: back[0], nBack: back.length, unresolvedAnchors };
    });
    expect(r.anchors.length, 'one point_handle -> two anchor entries (x, y)').toBe(2);
    expect(r.anchors.map((b) => b.role)).toEqual(['x', 'y']);
    expect(r.anchors.map((b) => b.param)).toEqual(['spotx', 'spoty']);
    expect(r.anchors.map((b) => b.key), 't2525 -- MERGED from the real bindings, not socket-less').toEqual(['clearance', 'retractZ']);
    expect(r.anchors.map((b) => b.default), "the REAL bindings' own defaults win").toEqual([5, 0]);
    // t2573 -- ax/ay are now the RAW AUTHORED STRING, not eagerly Number()'d: panelTypes.js's own
    // `anchor.kind==='point'` branch resolves each through `resolveAnchorCoord` (anchorSources.js), which
    // needs live `stock` (unavailable at this static-binding-build layer) so a NEW stock-token string
    // ('stockHalfW', ...) can anchor a point handle at a live stock-relative position -- a plain numeric
    // string still resolves byte-identical at render time, this is a representation change only.
    expect(r.anchors[0].anchor, 'the anchor is DECLARED {kind:point, ax, ay, label} -- no frame (distinct from layoutwidget)').toEqual({ kind: 'point', ax: '0', ay: '0', label: 'spot' });
    expect(r.merged.filter((b) => b.param === 'spotx' || b.param === 'spoty').length, 'exactly one entry per param, no duplicates').toBe(2);
    // reverse round-trip: the two merged bindings still re-nest into a feature_canvas carrying the SAME point_handle
    expect(r.nBack).toBe(1);
    expect(r.back0.type).toBe('feature_canvas');
    expect(r.back0.children).toEqual([{ type: 'point_handle', params: { fx: 'spotx', fy: 'spoty', x: '5', y: '0', ax: '0', ay: '0', label: 'spot' } }]);
    // FAIL VISIBLY: no matching real bindings -> both anchorUnresolved, never silently dropped
    expect(r.unresolvedAnchors.length).toBe(2);
    expect(r.unresolvedAnchors.every((b) => b.anchorUnresolved)).toBe(true);
});

test('a point-handle op: def.bindings MERGE the anchor onto the real bindings; layoutSpecFromOp still renders the handle; emit CHANGES when dragged (t2525 -- the central fix)', async ({ page }) => {
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
        const anchored = (def.bindings || []).filter((b) => b.anchor);
        const spec = layoutSpecFromOp(def, params, null, null, null, {}, () => {}, null);
        const h = (spec.handles || []).find((x) => /_pos$/.test(x.id) && x.kind === 'move');
        const emitDefault = emitMapped(builderOf(t)(U.defaultParams(def))).text;
        const emitDragged = emitMapped(builderOf(t)({ ...U.defaultParams(def), spotx: 9, spoty: 3 })).text;
        return {
            anchorKind: anchored[0] && anchored[0].anchor && anchored[0].anchor.kind,
            hasMatchKey: anchored.length === 2 && anchored.every((b) => b.blockIndex !== undefined && b.key !== undefined),
            hasHandle: !!h, handleX: h && h.x, handleY: h && h.y,
            emitChanges: emitDefault !== emitDragged,
        };
    }, OPTYPE);
    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, OPTYPE);
    expect(r.anchorKind, 'the binding carries the DECLARED anchor kind (point)').toBe('point');
    expect(r.hasMatchKey, 't2525 -- BOTH anchor-carrying bindings are now ALSO the real ones').toBe(true);
    expect(r.hasHandle, 'layoutSpecFromOp renders a draggable point handle for the merged binding, unchanged for the resolved case').toBe(true);
    expect(r.handleX, 'the handle sits at the param default (physical, anchor 0,0)').toBe(5);
    expect(r.handleY).toBe(0);
    expect(r.emitChanges, 't2525 -- the handle now reaches emit: dragging changes the G-code (was byte-identical before this fix)').toBe(true);
});

test.use({ viewport: { width: 2600, height: 1000 } });
test('DRIVE THE APP, THE t2525 BAR: two formfields placed FIRST (must-match pickers need them to exist), then feature_canvas + point_handle picking both params, real save, a REAL reload, then a REAL mouse drag on the rendered SVG handle changes the fields AND the emitted G-code', async ({ page }) => {
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
    // a "ref" is either a bare block TYPE (fine while only one exists) or "#<id>" to disambiguate once a
    // second block of the same type is on the workspace (formfield #2 etc) -- matches t2523's own convention.
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
    async function blockIdOf(type) { return page.evaluate((t) => window.__blkws.getAllBlocks(false).find((b) => b.type === t).id, type); }
    async function nudgeConnectionTogether(movingRef, movingConnName, targetRef, targetConnName) {
        const resolve = "(ws,ref)=>ref[0]==='#' ? ws.getAllBlocks(false).find(b=>b.id===ref.slice(1)) : ws.getAllBlocks(false).find(b=>b.type===ref)";
        await clearSearch();
        const gap = await page.evaluate(({ movingRef, movingConnName, targetRef, targetConnName, resolve }) => {
            const ws = window.__blkws;
            const r = eval(resolve);
            const mv = r(ws, movingRef), tg = r(ws, targetRef);
            const mvOff = mv[movingConnName].getOffsetInBlock();
            const mvRect = mv.getSvgRoot().getBoundingClientRect();
            const mvScreen = { x: mvRect.left + mvOff.x * ws.scale, y: mvRect.top + mvOff.y * ws.scale };
            const tgOff = tg[targetConnName].getOffsetInBlock();
            const tgRect = tg.getSvgRoot().getBoundingClientRect();
            const tgScreen = { x: tgRect.left + tgOff.x * ws.scale, y: tgRect.top + tgOff.y * ws.scale };
            const grabEl = mv.getSvgRoot().querySelector('text.blocklyText, .blocklyText') || mv.getSvgRoot();
            const grabRect = grabEl.getBoundingClientRect();
            return { dx: tgScreen.x - mvScreen.x, dy: tgScreen.y - mvScreen.y, grabPt: { x: grabRect.x + grabRect.width / 2, y: grabRect.y + grabRect.height / 2 } };
        }, { movingRef, movingConnName, targetRef, targetConnName, resolve });
        if (Math.hypot(gap.dx, gap.dy) < 1) return;
        await page.mouse.move(gap.grabPt.x, gap.grabPt.y);
        await page.mouse.down();
        await page.waitForTimeout(60);
        await page.mouse.move(gap.grabPt.x + gap.dx, gap.grabPt.y + gap.dy, { steps: 10 });
        await page.waitForTimeout(80);
        await page.mouse.up();
        await page.waitForTimeout(250);
    }

    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    // 1) user_root
    await searchFor('Define Custom Wizard');
    await dragFlyoutBlockTo('user_root', { x: 1900, y: 220 });

    // 2) progstart + progend into EXECUTION (their own clearance/retractZ fields are the eventual emit targets)
    const execMouth = await mouthPoint('user_root', 'EXECUTION');
    await searchFor('program start');
    await dragFlyoutBlockTo('progstart', execMouth);
    const psBottom = await stackBottomPoint('progstart');
    await searchFor('program end');
    await dragFlyoutBlockTo('progend', psBottom);
    await nudgeConnectionTogether('progend', 'previousConnection', 'progstart', 'nextConnection');

    // 3) param_group into PRESENTATION, then TWO formfields (Op Param -> progstart.clearance / progend.retractZ)
    //    -- BEFORE the handle, since its own pickers need both params to already exist.
    const presMouth = await mouthPoint('user_root', 'PRESENTATION');
    await searchFor('parameter group');
    await dragFlyoutBlockTo('param_group', presMouth);
    await setTextField('param_group', 'GROUP', 'Test');

    const pgMouth = await mouthPoint('param_group', 'DO');
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', pgMouth);
    const ff1 = '#' + await blockIdOf('formfield');
    await setTextField(ff1, 'PARAM', 'spotx');
    await setTextField(ff1, 'LABEL', 'X');
    await setTextField(ff1, 'DFLT', '5');
    await setDropdownField(ff1, 'BINDMODE', 'Op Param');
    await setPickerField(ff1, 'ATOMTYPE', 'progstart');
    await setTextField(ff1, 'KEY', 'clearance');

    const ff1Bottom = await stackBottomPoint(ff1);
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', ff1Bottom);
    const ff2 = '#' + await page.evaluate((id1) => window.__blkws.getAllBlocks(false).filter((b) => b.type === 'formfield').map((b) => b.id).find((id) => id !== id1), ff1.slice(1));
    await nudgeConnectionTogether(ff2, 'previousConnection', ff1, 'nextConnection');
    await setTextField(ff2, 'PARAM', 'spoty');
    await setTextField(ff2, 'LABEL', 'Y');
    await setTextField(ff2, 'DFLT', '0');
    await setDropdownField(ff2, 'BINDMODE', 'Op Param');
    await setPickerField(ff2, 'ATOMTYPE', 'progend');
    await setTextField(ff2, 'KEY', 'retractZ');

    // 4) feature_canvas stacked after param_group, then point_handle into ITS OWN mouth, picking BOTH params
    const pgBottom = await stackBottomPoint('param_group');
    await searchFor('feature canvas');
    await dragFlyoutBlockTo('feature_canvas', pgBottom);
    await nudgeConnectionTogether('feature_canvas', 'previousConnection', 'param_group', 'nextConnection');
    await setDropdownField('feature_canvas', 'PANEL', 'form2d');

    const fcMouth = await mouthPoint('feature_canvas', 'DO');
    await searchFor('point handle');
    await dragFlyoutBlockTo('point_handle', fcMouth);
    await setPickerField('point_handle', 'FX', 'spotx');
    await setPickerField('point_handle', 'FY', 'spoty');

    const fieldsSet = await page.evaluate(() => {
        const ws = window.__blkws;
        return {
            panel: ws.getAllBlocks(false).find((b) => b.type === 'feature_canvas').getFieldValue('PANEL'),
            fx: ws.getAllBlocks(false).find((b) => b.type === 'point_handle').getFieldValue('FX'),
            fy: ws.getAllBlocks(false).find((b) => b.type === 'point_handle').getFieldValue('FY'),
        };
    });
    expect(fieldsSet.panel).toBe('form2d');
    expect(fieldsSet.fx, 't2525 -- the picker committed an EXISTING param name, not free text').toBe('spotx');
    expect(fieldsSet.fy).toBe('spoty');

    // 5) save via the real dialog
    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 't2525 point handle pilot (live)');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(500);

    // 6) a REAL reload -- the saved op must survive
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const savedOpType = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 't2525 point handle pilot (live)');
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
            hasFxField: !!f.querySelector('[data-param="spotx"]'), hasFyField: !!f.querySelector('[data-param="spoty"]'),
            svgPresent: !!svg,
            handles: svg ? svg.querySelectorAll('rect.fc-handle, .fc-handle, [data-handle]').length : 0,
        };
    });
    expect(rendered.hasFxField, 'the spotx param renders a real form row').toBe(true);
    expect(rendered.hasFyField).toBe(true);
    expect(rendered.svgPresent, 'the 2D FeatureCanvas SVG renders').toBe(true);
    expect(rendered.handles, 'at least one interactive handle renders on the canvas').toBeGreaterThan(0);

    // 7) THE REAL GESTURE: a mouse drag on the rendered SVG handle
    const handleRect = await page.evaluate(() => {
        const svg = document.getElementById('userVizContainer').querySelector('svg');
        const h = svg.querySelector('rect.fc-handle, .fc-handle, [data-handle]');
        const r = h.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const before = await page.evaluate(() => ({
        x: document.querySelector('#wiz_user_form [data-param="spotx"]').value,
        y: document.querySelector('#wiz_user_form [data-param="spoty"]').value,
    }));
    await page.mouse.move(handleRect.x, handleRect.y);
    await page.mouse.down();
    await page.mouse.move(handleRect.x + 40, handleRect.y + 30, { steps: 15 });
    await page.mouse.move(handleRect.x + 40, handleRect.y + 30, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
        x: document.querySelector('#wiz_user_form [data-param="spotx"]').value,
        y: document.querySelector('#wiz_user_form [data-param="spoty"]').value,
    }));

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2525-point-handle-emit-wired.png', clip: _b }); }

    // t2525's own whole point, verified with the EXACT field values the real drag just produced.
    const emit = await page.evaluate(async ({ t, before, after }) => {
        const U = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.listUserOps().find((d) => d.opType === t);
        const base = U.defaultParams(def);
        const emitBefore = emitMapped(builderOf(t)({ ...base, spotx: Number(before.x), spoty: Number(before.y) })).text;
        const emitAfter = emitMapped(builderOf(t)({ ...base, spotx: Number(after.x), spoty: Number(after.y) })).text;
        return { emitBefore, emitAfter };
    }, { t: savedOpType, before, after });

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, savedOpType);

    expect(after.x, 'a REAL mouse drag on the SVG handle changed spotx (assert-the-value)').not.toBe(before.x);
    expect(after.y, 'a REAL mouse drag on the SVG handle changed spoty').not.toBe(before.y);
    expect(emit.emitAfter, 't2525 -- THE central fix, verified live: the exact before/after field values a real drag produced emit DIFFERENT G-code (was byte-identical before this fix)').not.toBe(emit.emitBefore);
});

test('DRIVE THE APP, THE SAME t2525 BAR IN ASSIGN-VAR MODE (t2665, gap 9): two formfields bound to two real `assign` blocks (not Op Param), point_handle picking both -- real save, a REAL reload, a REAL mouse drag on the rendered SVG handle changes the fields AND the emitted G-code', async ({ page }) => {
    // t2665 root cause (userOps.js formfieldBindings): deriveBindings THROWS on the FIRST spec that fails to
    // match exactly one block, and the old formfieldBindings swallowed that single throw into a BLANKET []　for
    // EVERY formfield in the stack -- not just the one that actually failed. Two Assign-mode formfields sharing
    // one param_group meant one mistyped/stale matchvar (an easy authoring slip -- the field defaults non-blank
    // to '#1') silently voided the OTHER, perfectly-valid formfield's binding too, and by extension BOTH
    // point_handle targets reported unresolved ("2 handle fields declared, 0 matched") even though only one was
    // ever actually broken. This is NOT bind-mode-specific (an Op Param stack with one bad ATOMTYPE/KEY hits the
    // identical failure) -- it looked like "Assign mode is refused" only because the live session's own Op Param
    // build happened to get both specs right on the first try. The fix (formfieldBindings now derives one spec
    // at a time, isolating a bad spec to itself) is proven here the SAME way t2525's own Op-Param bar was: two
    // CORRECTLY-wired Assign-mode formfields reaching full completeness -- form renders, canvas renders, a REAL
    // drag changes both fields, and emit changes to match.
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
    async function blockIdOf(type) { return page.evaluate((t) => window.__blkws.getAllBlocks(false).find((b) => b.type === t).id, type); }
    async function nudgeConnectionTogether(movingRef, movingConnName, targetRef, targetConnName) {
        const resolve = "(ws,ref)=>ref[0]==='#' ? ws.getAllBlocks(false).find(b=>b.id===ref.slice(1)) : ws.getAllBlocks(false).find(b=>b.type===ref)";
        await clearSearch();
        const gap = await page.evaluate(({ movingRef, movingConnName, targetRef, targetConnName, resolve }) => {
            const ws = window.__blkws;
            const r = eval(resolve);
            const mv = r(ws, movingRef), tg = r(ws, targetRef);
            const mvOff = mv[movingConnName].getOffsetInBlock();
            const mvRect = mv.getSvgRoot().getBoundingClientRect();
            const mvScreen = { x: mvRect.left + mvOff.x * ws.scale, y: mvRect.top + mvOff.y * ws.scale };
            const tgOff = tg[targetConnName].getOffsetInBlock();
            const tgRect = tg.getSvgRoot().getBoundingClientRect();
            const tgScreen = { x: tgRect.left + tgOff.x * ws.scale, y: tgRect.top + tgOff.y * ws.scale };
            const grabEl = mv.getSvgRoot().querySelector('text.blocklyText, .blocklyText') || mv.getSvgRoot();
            const grabRect = grabEl.getBoundingClientRect();
            return { dx: tgScreen.x - mvScreen.x, dy: tgScreen.y - mvScreen.y, grabPt: { x: grabRect.x + grabRect.width / 2, y: grabRect.y + grabRect.height / 2 } };
        }, { movingRef, movingConnName, targetRef, targetConnName, resolve });
        if (Math.hypot(gap.dx, gap.dy) < 1) return;
        await page.mouse.move(gap.grabPt.x, gap.grabPt.y);
        await page.mouse.down();
        await page.waitForTimeout(60);
        await page.mouse.move(gap.grabPt.x + gap.dx, gap.grabPt.y + gap.dy, { steps: 10 });
        await page.waitForTimeout(80);
        await page.mouse.up();
        await page.waitForTimeout(250);
    }

    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    // 1) user_root
    await searchFor('Define Custom Wizard');
    await dragFlyoutBlockTo('user_root', { x: 1900, y: 220 });

    // 2) EXECUTION: progstart + progend (a realistic program frame), THEN two `assign` blocks -- the natural
    //    #var-write targets a probe/capture wizard uses (t2637's own original choice, not Op Param).
    const execMouth = await mouthPoint('user_root', 'EXECUTION');
    await searchFor('program start');
    await dragFlyoutBlockTo('progstart', execMouth);
    const psBottom = await stackBottomPoint('progstart');
    await searchFor('program end');
    await dragFlyoutBlockTo('progend', psBottom);
    await nudgeConnectionTogether('progend', 'previousConnection', 'progstart', 'nextConnection');

    const peBottom = await stackBottomPoint('progend');
    await searchFor('Set #');
    await dragFlyoutBlockTo('assign', peBottom);
    await nudgeConnectionTogether('assign', 'previousConnection', 'progend', 'nextConnection');
    const assignX = '#' + await blockIdOf('assign');
    await setTextField(assignX, 'VAR', '#100');

    const axBottom = await stackBottomPoint(assignX);
    await searchFor('Set #');
    await dragFlyoutBlockTo('assign', axBottom);
    const assignY = '#' + await page.evaluate((id1) => window.__blkws.getAllBlocks(false).filter((b) => b.type === 'assign').map((b) => b.id).find((id) => id !== id1), assignX.slice(1));
    await nudgeConnectionTogether(assignY, 'previousConnection', assignX, 'nextConnection');
    await setTextField(assignY, 'VAR', '#101');

    // 3) param_group into PRESENTATION, then TWO formfields -- Assign Var mode (the block's own DEFAULT bindMode),
    //    matchvar picking each assign block's own var -- BEFORE the handle, since its pickers need both params to exist.
    const presMouth = await mouthPoint('user_root', 'PRESENTATION');
    await searchFor('parameter group');
    await dragFlyoutBlockTo('param_group', presMouth);
    await setTextField('param_group', 'GROUP', 'Test');

    const pgMouth = await mouthPoint('param_group', 'DO');
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', pgMouth);
    const ff1 = '#' + await blockIdOf('formfield');
    await setTextField(ff1, 'PARAM', 'spotx');
    await setTextField(ff1, 'LABEL', 'X');
    await setTextField(ff1, 'DFLT', '5');
    await setDropdownField(ff1, 'BINDMODE', 'Assign Var');
    await setPickerField(ff1, 'MATCHVAR', '#100');

    const ff1Bottom = await stackBottomPoint(ff1);
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', ff1Bottom);
    const ff2 = '#' + await page.evaluate((id1) => window.__blkws.getAllBlocks(false).filter((b) => b.type === 'formfield').map((b) => b.id).find((id) => id !== id1), ff1.slice(1));
    await nudgeConnectionTogether(ff2, 'previousConnection', ff1, 'nextConnection');
    await setTextField(ff2, 'PARAM', 'spoty');
    await setTextField(ff2, 'LABEL', 'Y');
    await setTextField(ff2, 'DFLT', '0');
    await setDropdownField(ff2, 'BINDMODE', 'Assign Var');
    await setPickerField(ff2, 'MATCHVAR', '#101');

    // 4) feature_canvas stacked after param_group, then point_handle into ITS OWN mouth, picking BOTH params
    const pgBottom = await stackBottomPoint('param_group');
    await searchFor('feature canvas');
    await dragFlyoutBlockTo('feature_canvas', pgBottom);
    await nudgeConnectionTogether('feature_canvas', 'previousConnection', 'param_group', 'nextConnection');
    await setDropdownField('feature_canvas', 'PANEL', 'form2d');

    const fcMouth = await mouthPoint('feature_canvas', 'DO');
    await searchFor('point handle');
    await dragFlyoutBlockTo('point_handle', fcMouth);
    await setPickerField('point_handle', 'FX', 'spotx');
    await setPickerField('point_handle', 'FY', 'spoty');

    const fieldsSet = await page.evaluate(() => {
        const ws = window.__blkws;
        return {
            panel: ws.getAllBlocks(false).find((b) => b.type === 'feature_canvas').getFieldValue('PANEL'),
            fx: ws.getAllBlocks(false).find((b) => b.type === 'point_handle').getFieldValue('FX'),
            fy: ws.getAllBlocks(false).find((b) => b.type === 'point_handle').getFieldValue('FY'),
        };
    });
    expect(fieldsSet.panel).toBe('form2d');
    expect(fieldsSet.fx, 't2525 -- the picker committed an EXISTING param name, not free text').toBe('spotx');
    expect(fieldsSet.fy).toBe('spoty');

    // 5) save via the real dialog
    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 't2665 assign-mode point handle pilot (live)');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(500);

    // 6) a REAL reload -- the saved op must survive
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const savedOpType = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 't2665 assign-mode point handle pilot (live)');
        return d ? d.opType : null;
    });
    expect(savedOpType, 'the saved wizard survives a REAL reload, found by listUserOps -- Assign mode was never refused').toBeTruthy();

    await page.evaluate((t) => window.openWiz(t), savedOpType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);

    const rendered = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const c = document.getElementById('userVizContainer');
        const svg = c && c.querySelector('svg');
        return {
            hasFxField: !!f.querySelector('[data-param="spotx"]'), hasFyField: !!f.querySelector('[data-param="spoty"]'),
            svgPresent: !!svg,
            handles: svg ? svg.querySelectorAll('rect.fc-handle, .fc-handle, [data-handle]').length : 0,
        };
    });
    expect(rendered.hasFxField, 'the spotx param renders a real form row -- Assign-mode binding reached the form').toBe(true);
    expect(rendered.hasFyField).toBe(true);
    expect(rendered.svgPresent, 'the 2D FeatureCanvas SVG renders').toBe(true);
    expect(rendered.handles, 'a REAL (non-broken) handle renders on the canvas -- not the red anchorUnresolved marker').toBeGreaterThan(0);

    // 7) THE REAL GESTURE: a mouse drag on the rendered SVG handle
    const handleRect = await page.evaluate(() => {
        const svg = document.getElementById('userVizContainer').querySelector('svg');
        const h = svg.querySelector('rect.fc-handle, .fc-handle, [data-handle]');
        const r = h.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const before = await page.evaluate(() => ({
        x: document.querySelector('#wiz_user_form [data-param="spotx"]').value,
        y: document.querySelector('#wiz_user_form [data-param="spoty"]').value,
    }));
    await page.mouse.move(handleRect.x, handleRect.y);
    await page.mouse.down();
    await page.mouse.move(handleRect.x + 40, handleRect.y + 30, { steps: 15 });
    await page.mouse.move(handleRect.x + 40, handleRect.y + 30, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
        x: document.querySelector('#wiz_user_form [data-param="spotx"]').value,
        y: document.querySelector('#wiz_user_form [data-param="spoty"]').value,
    }));

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2665-assign-mode-point-handle-emit-wired.png', clip: _b }); }

    const emit = await page.evaluate(async ({ t, before, after }) => {
        const U = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.listUserOps().find((d) => d.opType === t);
        const base = U.defaultParams(def);
        const emitBefore = emitMapped(builderOf(t)({ ...base, spotx: Number(before.x), spoty: Number(before.y) })).text;
        const emitAfter = emitMapped(builderOf(t)({ ...base, spotx: Number(after.x), spoty: Number(after.y) })).text;
        return { emitBefore, emitAfter };
    }, { t: savedOpType, before, after });

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, savedOpType);

    expect(after.x, 'a REAL mouse drag on the SVG handle changed spotx (assert-the-value)').not.toBe(before.x);
    expect(after.y, 'a REAL mouse drag on the SVG handle changed spoty').not.toBe(before.y);
    expect(emit.emitAfter, 't2665 -- Assign-Var mode reaches the SAME live-drag-to-emit bar Op Param mode already had, fixed at formfieldBindings\' own per-spec isolation').not.toBe(emit.emitBefore);
});
