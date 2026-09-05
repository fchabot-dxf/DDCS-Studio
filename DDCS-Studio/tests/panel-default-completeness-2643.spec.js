import { test, expect } from '@playwright/test';

/**
 * t2643 (BACKLOG #71/#72) — THE COMPLETENESS BAR, WITHOUT THE WORKAROUND. Byte-identical to
 * point-handle-block.spec.js's own "DRIVE THE APP, THE t2525 BAR" test EXCEPT one line removed: this build
 * never calls setDropdownField('feature_canvas', 'PANEL', 'form2d') — the exact step a person following no
 * special knowledge would not know to take (t2639's own honest account: nothing in the UI says a fresh
 * feature_canvas needs its own panel field touched). Proves the panel-default-2643.spec.js fix is sufficient
 * on its own: a person who drags feature_canvas + point_handle, wires two formfields, and saves — never once
 * opening the feature_canvas block's own PANEL dropdown — still gets a rendered, working, write-back handle.
 */
const OPNAME = 't2643 point handle completeness bar (live, no panel override)';

test.use({ viewport: { width: 2600, height: 1000 } });
test('COMPLETENESS BAR: a person who never touches feature_canvas\'s own PANEL field still gets a rendered handle that writes back to a field and to emit', async ({ page }) => {
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
    async function setDropdownField(blockType, fieldName, optionText) {
        await clearSearch();
        await centerOn(blockType);
        const rect = await fieldRect(blockType, fieldName);
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(250);
        await page.locator('.blocklyMenuItem', { hasText: optionText }).first().click({ timeout: 3000 });
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

    await searchFor('Define Custom Wizard');
    await dragFlyoutBlockTo('user_root', { x: 1900, y: 220 });

    const execMouth = await mouthPoint('user_root', 'EXECUTION');
    await searchFor('program start');
    await dragFlyoutBlockTo('progstart', execMouth);
    const psBottom = await stackBottomPoint('progstart');
    await searchFor('program end');
    await dragFlyoutBlockTo('progend', psBottom);
    await nudgeConnectionTogether('progend', 'previousConnection', 'progstart', 'nextConnection');

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

    // feature_canvas + point_handle -- NO setDropdownField('feature_canvas','PANEL',...) call. This IS the test:
    // a person who never opens this block's own PANEL dropdown must still get a working 2D canvas.
    const pgBottom = await stackBottomPoint('param_group');
    await searchFor('feature canvas');
    await dragFlyoutBlockTo('feature_canvas', pgBottom);
    await nudgeConnectionTogether('feature_canvas', 'previousConnection', 'param_group', 'nextConnection');

    const fcMouth = await mouthPoint('feature_canvas', 'DO');
    await searchFor('point handle');
    await dragFlyoutBlockTo('point_handle', fcMouth);
    await setPickerField('point_handle', 'FX', 'spotx');
    await setPickerField('point_handle', 'FY', 'spoty');

    const fieldsSet = await page.evaluate(() => ({
        panel: window.__blkws.getAllBlocks(false).find((b) => b.type === 'feature_canvas').getFieldValue('PANEL'),
        fx: window.__blkws.getAllBlocks(false).find((b) => b.type === 'point_handle').getFieldValue('FX'),
        fy: window.__blkws.getAllBlocks(false).find((b) => b.type === 'point_handle').getFieldValue('FY'),
    }));
    expect(fieldsSet.panel, 'the fix: never touched, and still form2d').toBe('form2d');
    expect(fieldsSet.fx).toBe('spotx');
    expect(fieldsSet.fy).toBe('spoty');

    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', OPNAME);
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(500);

    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const savedOpType = await page.evaluate(async (name) => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === name);
        return d ? d.opType : null;
    }, OPNAME);
    expect(savedOpType, 'the saved wizard survives a REAL reload').toBeTruthy();

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
    expect(rendered.svgPresent, 'THE FIX: the 2D FeatureCanvas SVG renders — this was the completely empty pane t2639 found').toBe(true);
    expect(rendered.handles, 'at least one interactive handle renders on the canvas — this was zero before the fix').toBeGreaterThan(0);

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

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2643-completeness-bar.png', clip: _b }); }

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

    expect(after.x, 'a REAL mouse drag on the SVG handle changed spotx').not.toBe(before.x);
    expect(after.y, 'a REAL mouse drag on the SVG handle changed spoty').not.toBe(before.y);
    expect(emit.emitAfter, 'THE COMPLETENESS BAR: a person who never touched PANEL still gets a drag that reaches emit').not.toBe(emit.emitBefore);
});
