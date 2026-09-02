import { test, expect } from '@playwright/test';

/**
 * t2527 (BACKLOG #71) — three form-render defects found while wiring handles for real (t2525), all in one
 * area, fixed together as one concern:
 *   1. formfield/param_field's own WIDGET dropdown committed 'tool-library'/'thread-preset', but
 *      formWidgets.js's real FORM_WIDGETS registry has always keyed these 'toolpick'/'threadpick' — a picker
 *      authored with either NEVER reached the real widget, silently degrading to a plain number input.
 *   2. rect_handle's own form row could show a generic SHARED_LABELS text instead of its declared anchor
 *      label when the merged real binding left its own label blank and had no SHARED_LABELS entry.
 *   3. An unresolved handle's own fail-visibly stub (t2525) produced a stray, uninformative extra form row
 *      beside the canvas's own correct red marker.
 * PLUS the general pattern question the dispatch asked to be answered, not just patched around:
 * resolveFormWidget's own not-found case (ANY unrecognized widget string, from ANY source) silently degrades
 * to a type-based default with no signal anywhere — confirmed real and general, not isolated to these two
 * strings; a loud (non-blocking) console.warn now marks that fallback whenever a widget WAS declared and
 * didn't resolve, distinguishing it from the normal, silent "no widget declared" case.
 */

test('the widget-key mismatch: FORM_WIDGETS really does key these toolpick/threadpick, and bridge.js\'s own dropdown vocabulary now commits those exact values', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { FORM_WIDGETS } = await import('/ui/formWidgets.js');
        const { fieldOptions } = await import('/blocks/blockly/bridge.js');
        const formfieldOpts = fieldOptions({ type: 'formfield', kind: 'formfield', defaults: {} }, 'widget');
        const paramFieldOpts = fieldOptions({ type: 'param_field', kind: 'param_field', defaults: {} }, 'widget');
        const findValue = (opts, label) => { const o = opts.find((x) => Array.isArray(x) ? x[0] === label : x === label); return Array.isArray(o) ? o[1] : o; };
        return {
            hasToolpickKey: typeof FORM_WIDGETS.toolpick === 'function',
            hasThreadpickKey: typeof FORM_WIDGETS.threadpick === 'function',
            hasOldHyphenKeys: ('tool-library' in FORM_WIDGETS) || ('thread-preset' in FORM_WIDGETS),
            formfieldToolValue: findValue(formfieldOpts, 'tool-library'),
            formfieldThreadValue: findValue(formfieldOpts, 'thread-preset'),
            paramFieldToolValue: findValue(paramFieldOpts, 'tool-library'),
        };
    });
    expect(r.hasToolpickKey, 'FORM_WIDGETS really does key the tool picker widget toolpick, not tool-library').toBe(true);
    expect(r.hasThreadpickKey).toBe(true);
    expect(r.hasOldHyphenKeys, 'no widget is ACTUALLY registered under the old hyphenated names -- confirms they were always unreachable').toBe(false);
    expect(r.formfieldToolValue, 'the dropdown option labelled "tool-library" now commits the value FORM_WIDGETS actually reads').toBe('toolpick');
    expect(r.formfieldThreadValue).toBe('threadpick');
    expect(r.paramFieldToolValue, 'param_field shares formfield\'s widget vocab -- same fix, same file').toBe('toolpick');
});

test.use({ viewport: { width: 2600, height: 1000 } });
test('DRIVE THE APP: a formfield authored with the Tool Library widget renders the REAL <select> picker, not a plain number input -- the real widget, not just a string', async ({ page }) => {
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
        const menuCount = await page.locator('.blocklyMenuItem').count();
        if (menuCount === 0) {
            const elAt = await page.evaluate((pt) => {
                const el = document.elementFromPoint(pt.x, pt.y);
                const path = [];
                let cur = el;
                while (cur && path.length < 5) { const cls = cur.className && cur.className.baseVal !== undefined ? cur.className.baseVal : cur.className; path.push(cur.tagName + (cls ? '.' + String(cls).split(' ').join('.') : '')); cur = cur.parentElement; }
                return path;
            }, rect);
            throw new Error(`no menu for ${blockType}.${fieldName} at ${JSON.stringify(rect)}: elAt=${JSON.stringify(elAt)}`);
        }
        const texts = await page.locator('.blocklyMenuItem').allTextContents();
        if (!texts.some((t) => t.includes(optionText))) throw new Error(`menu open but no "${optionText}" among: ${JSON.stringify(texts)}`);
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

    await searchFor('Define Custom Wizard');
    await dragFlyoutBlockTo('user_root', { x: 1900, y: 220 });

    // progstart into EXECUTION -- a real atom socket for the formfield's own Op Param bind (needed for the
    // save-time formfieldMatchReport to resolve; the widget-key fix under test is otherwise unrelated to this).
    const execMouth = await mouthPoint('user_root', 'EXECUTION');
    await searchFor('program start');
    await dragFlyoutBlockTo('progstart', execMouth);

    const presMouth = await mouthPoint('user_root', 'PRESENTATION');
    await searchFor('parameter group');
    await dragFlyoutBlockTo('param_group', presMouth);
    await setTextField('param_group', 'GROUP', 'Test');

    const pgMouth = await mouthPoint('param_group', 'DO');
    await searchFor('form field');
    await dragFlyoutBlockTo('formfield', pgMouth);
    await setTextField('formfield', 'PARAM', 'toolNum');
    await setTextField('formfield', 'LABEL', 'Tool');
    await setDropdownField('formfield', 'BINDMODE', 'Op Param');
    await setPickerField('formfield', 'ATOMTYPE', 'progstart');
    await setTextField('formfield', 'KEY', 'clearance');
    await setDropdownField('formfield', 'WIDGET', 'tool-library');

    const widgetVal = await page.evaluate(() => window.__blkws.getAllBlocks(false).find((b) => b.type === 'formfield').getFieldValue('WIDGET'));
    expect(widgetVal, 'the dropdown committed the REAL FORM_WIDGETS key').toBe('toolpick');

    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 't2527 toolpick widget pilot (live)');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(500);

    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const savedOpType = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 't2527 toolpick widget pilot (live)');
        return d ? d.opType : null;
    });
    expect(savedOpType, 'the saved wizard survives a REAL reload').toBeTruthy();

    await page.evaluate((t) => window.openWiz(t), savedOpType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);

    const rendered = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const el = f.querySelector('[data-param="toolNum"]');
        return { exists: !!el, tag: el && el.tagName, isSelect: el && el.tagName === 'SELECT', optionCount: el && el.tagName === 'SELECT' ? el.options.length : 0 };
    });

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2527-toolpick-widget-live.png', clip: _b }); }

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, savedOpType);

    expect(rendered.exists, 'the toolNum param renders a real form row').toBe(true);
    expect(rendered.isSelect, 't2527 -- the REAL toolpick widget rendered (a <select>), not a plain <input type=number>').toBe(true);
    expect(rendered.optionCount, 'the picker has at least its own "No tool" option').toBeGreaterThan(0);
});

test('labelFor: SHARED_LABELS still wins for a handle-merged w/h param (no regression); a handle\'s own anchor.label fills in only when NEITHER an explicit label NOR SHARED_LABELS has one', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { labelFor } = await import('/ui/formWidgets.js');
        return {
            // rect_handle merged onto a real 'w' param, no explicit label -- SHARED_LABELS.w = 'Width' must still win
            sharedLabelWins: labelFor({ param: 'w', anchor: { kind: 'rect', label: 'W×H' } }),
            sharedLabelWinsH: labelFor({ param: 'h', anchor: { kind: 'rect', label: 'W×H' } }),
            // a param with NO SHARED_LABELS entry and no explicit label -- anchor.label now fills the gap instead of the raw name
            anchorFillsGap: labelFor({ param: 'boxreach', anchor: { kind: 'length', label: 'reach' } }),
            // an explicit label still wins over everything, unchanged
            explicitWins: labelFor({ param: 'w', label: 'Custom', anchor: { kind: 'rect', label: 'W×H' } }),
            // no anchor at all (every built-in, every plain formfield) -- byte-identical to before this turn
            plainRawFallback: labelFor({ param: 'someUnknownParam' }),
        };
    });
    expect(r.sharedLabelWins, 'no regression: the w-row keeps its own correct, DISTINCT "Width" label').toBe('Width');
    expect(r.sharedLabelWinsH, 'no regression: the h-row keeps its own correct, DISTINCT "Height" label').toBe('Height');
    expect(r.anchorFillsGap, "the handle's own declared intent now fills the gap instead of a raw, uninformative param name").toBe('reach');
    expect(r.explicitWins).toBe('Custom');
    expect(r.plainRawFallback).toBe('someUnknownParam');
});

test('renderOpForm: an unresolved handle\'s own fail-visibly stub renders NO form row (the canvas red marker stays the sole signal); a normal binding is unaffected', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { renderOpForm } = await import('/ui/formWidgets.js');
        const host = document.createElement('div');
        document.body.appendChild(host);
        const bindings = [
            { param: 'width', type: 'number', default: 100, label: 'Width' },
            { param: 'ghost', type: 'number', anchor: { kind: 'length', label: 'reach' }, anchorUnresolved: true },
        ];
        renderOpForm(host, bindings);
        const rows = host.querySelectorAll('[data-param]');
        const result = { rowCount: rows.length, hasWidth: !!host.querySelector('[data-param="width"]'), hasGhost: !!host.querySelector('[data-param="ghost"]') };
        host.remove();
        return result;
    });
    expect(r.hasWidth, 'a normal, resolved binding still renders its own row -- unaffected').toBe(true);
    expect(r.hasGhost, 't2527 -- the unresolved stub renders NO row at all, not even a hidden one (nothing else reads it)').toBe(false);
    expect(r.rowCount, 'exactly one row total, not two').toBe(1);
});

test('resolveFormWidget: the general pattern -- a declared-but-unrecognized widget string warns loudly (not silently); an undeclared widget stays silent (the normal case)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const warnings = [];
    page.on('console', (msg) => { if (msg.type() === 'warning') warnings.push(msg.text()); });
    await page.waitForFunction(() => true);
    await page.evaluate(async () => {
        const { resolveFormWidget } = await import('/ui/formWidgets.js');
        resolveFormWidget({ param: 'someParam', widget: 'this-key-does-not-exist', type: 'number' });
        resolveFormWidget({ param: 'plainNumber', type: 'number' });   // no widget declared at all -- must stay silent
        resolveFormWidget({ param: 'wired', widget: 'toolpick', type: 'number' });   // a REAL key -- must stay silent
    });
    await page.waitForTimeout(100);
    const matching = warnings.filter((w) => w.includes('someParam'));
    const falsePositives = warnings.filter((w) => w.includes('plainNumber') || w.includes('wired'));
    expect(matching.length, 'a declared-but-unrecognized widget string warns loudly').toBeGreaterThan(0);
    expect(matching[0]).toContain('this-key-does-not-exist');
    expect(falsePositives.length, 'no widget declared, or a REAL widget key, stays silent -- not a blanket warning on every call').toBe(0);
});
