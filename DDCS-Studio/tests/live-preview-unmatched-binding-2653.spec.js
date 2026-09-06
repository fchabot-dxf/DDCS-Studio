import { test, expect } from '@playwright/test';

/**
 * t2653 (owner-approved doorway pair, part 2) — t2639's own finding ("the live Wizard View / form preview does
 * NOT refresh while actively building... only picks up the real state after Save") ROOT-CAUSED, not assumed:
 * the reactive pipeline itself (Blockly change → reproject() → renderLiveForm() → deriveAuthoredDef(), all
 * synchronous, all fresh off `workspaceToStack(ws)` every single edit — confirmed by reading every link in the
 * chain, no cache, no snapshot anywhere) already updates live. Proven live, not reasoned: replaying t2639's own
 * build sequence step by step and inspecting `def.bindings` at each step showed the FORM (`#blk_wiz_user`) DOES
 * render the real field the instant a `formfield`'s binding spec actually resolves — no save required.
 *
 * THE ACTUAL GAP: a `formfield` whose spec never MATCHES anything on the canvas — the DEFAULT `bindMode:
 * 'assign'` needs a separate "Set Variable #1" block elsewhere; `'opparam'` mode needs an atom of the chosen
 * type — correctly produces zero bindings (`deriveBindings`'s own documented behaviour: "returns [] on an
 * unmatched var... instead of throwing"). But the message shown for that case was BYTE-IDENTICAL to "you
 * haven't added a Form field at all" — so a 90%-configured field and a blank Presentation mouth looked the
 * same to the person building it, which reads exactly like "the preview never updates." Fixed by reading
 * `formfieldMatchReport` (userOps.js) — the SAME unmatched-binding detector the save-time guard already
 * uses — live, in the empty-state branch, and naming what's actually missing.
 */
test.use({ viewport: { width: 2000, height: 1000 } });

async function bootBlocks(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);
}
async function clearSearch(page) { await page.evaluate(() => { const s = document.querySelector('.blk-search'); if (s) { s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); } }); await page.waitForTimeout(100); }
async function searchFor(page, text) { await clearSearch(page); const s = page.locator('.blk-search'); await s.click(); await s.fill(text); await page.waitForTimeout(250); }
async function flyoutBlockCenter(page, type) {
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
async function flyoutDragOffset(page, type) {
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
async function dragFlyoutBlockTo(page, type, targetPt) {
    const grab = await flyoutBlockCenter(page, type);
    const off = await flyoutDragOffset(page, type);
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
async function mouthPoint(page, blockType, inputName) {
    return page.evaluate(({ blockType, inputName }) => {
        const ws = window.__blkws;
        const blk = ws.getAllBlocks(false).find((b) => b.type === blockType);
        const inp = blk.inputList.find((i) => i.name === inputName);
        const off = inp.connection.getOffsetInBlock();
        const rect = blk.getSvgRoot().getBoundingClientRect();
        return { x: rect.left + off.x * ws.scale, y: rect.top + off.y * ws.scale };
    }, { blockType, inputName });
}
async function centerOn(page, blockType) {
    await page.evaluate((t) => { const ws = window.__blkws; const blk = ws.getAllBlocks(false).find((b) => b.type === t); if (blk) ws.centerOnBlock(blk.id, true); }, blockType);
    await page.waitForTimeout(400);
}
async function fieldRect(page, blockType, fieldName) {
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
async function setTextField(page, blockType, fieldName, value) {
    await clearSearch(page);
    const rect = await fieldRect(page, blockType, fieldName);
    await page.mouse.click(rect.x, rect.y);
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+A');
    await page.keyboard.type(String(value));
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
}
async function formHTML(page) {
    return page.evaluate(() => (document.getElementById('blk-form') || {}).innerHTML || '');
}

test('LIVE, no save: a formfield with an unmatched default (assign) bind names what is missing, not the generic empty message', async ({ page }) => {
    await bootBlocks(page);
    await searchFor(page, 'Define Custom Wizard');
    await dragFlyoutBlockTo(page, 'user_root', { x: 1500, y: 220 });

    const presMouth = await mouthPoint(page, 'user_root', 'PRESENTATION');
    await searchFor(page, 'parameter group');
    await dragFlyoutBlockTo(page, 'param_group', presMouth);
    await setTextField(page, 'param_group', 'GROUP', 'Test');

    const before = await formHTML(page);
    expect(before, 'no formfield yet — the generic empty message').toContain('add a');

    const pgMouth = await mouthPoint(page, 'param_group', 'DO');
    await searchFor(page, 'form field');
    await dragFlyoutBlockTo(page, 'formfield', pgMouth);
    await setTextField(page, 'formfield', 'PARAM', 'reach');

    const after = await formHTML(page);
    expect(after, 'LIVE — no save happened; this is a fresh page.evaluate read of the current DOM').toContain('reach');
    expect(after, 'names WHY it is unbound, not the generic "add a Form field" message (there IS one)').toContain('not bound to anything yet');
    expect(after, 'assign mode default bind target is named').toContain('Match Var');
});

test('LIVE, no save: the SAME wizard, once the binding actually resolves, renders the real field instantly', async ({ page }) => {
    await bootBlocks(page);
    await searchFor(page, 'Define Custom Wizard');
    await dragFlyoutBlockTo(page, 'user_root', { x: 1500, y: 220 });

    const execMouth = await mouthPoint(page, 'user_root', 'EXECUTION');
    await searchFor(page, 'program start');
    await dragFlyoutBlockTo(page, 'progstart', execMouth);

    const presMouth = await mouthPoint(page, 'user_root', 'PRESENTATION');
    await searchFor(page, 'parameter group');
    await dragFlyoutBlockTo(page, 'param_group', presMouth);
    await setTextField(page, 'param_group', 'GROUP', 'Test');

    const pgMouth = await mouthPoint(page, 'param_group', 'DO');
    await searchFor(page, 'form field');
    await dragFlyoutBlockTo(page, 'formfield', pgMouth);
    await setTextField(page, 'formfield', 'PARAM', 'reach');

    const unmatched = await formHTML(page);
    expect(unmatched).toContain('not bound to anything yet');

    // Resolve it live — same page, same session, no reload, no Save click anywhere in this test.
    await clearSearch(page);
    await centerOn(page, 'formfield');
    const rect = await fieldRect(page, 'formfield', 'BINDMODE');
    await page.mouse.click(rect.x, rect.y);
    await page.waitForTimeout(250);
    await page.locator('.blocklyMenuItem', { hasText: 'Op Param' }).first().click({ timeout: 3000 });
    await page.waitForTimeout(150);
    await clearSearch(page);
    const atRect = await fieldRect(page, 'formfield', 'ATOMTYPE');
    await page.mouse.click(atRect.x, atRect.y);
    await page.waitForTimeout(250);
    await page.locator('.ddcs-picker-row', { hasText: 'progstart' }).first().click({ timeout: 3000 });
    await page.waitForTimeout(150);
    await setTextField(page, 'formfield', 'KEY', 'clearance');

    const resolved = await page.evaluate(() => {
        const blkHost = document.getElementById('blk_wiz_user');
        const formHost = document.getElementById('blk-form');
        return {
            formHidden: formHost ? formHost.style.display === 'none' : false,
            blkVisible: blkHost ? blkHost.style.display !== 'none' : false,
            blkHasReach: blkHost ? /reach/i.test(blkHost.innerHTML) : false,
        };
    });
    expect(resolved.blkVisible, 'the resolved form face is shown, live, no reload/save').toBe(true);
    expect(resolved.blkHasReach, 'the "reach" field actually renders the instant the binding resolves').toBe(true);
});

test('a formfield left in a genuinely EMPTY presentation (no param_group at all) never throws — the empty-message path degrades gracefully', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await bootBlocks(page);
    await searchFor(page, 'Define Custom Wizard');
    await dragFlyoutBlockTo(page, 'user_root', { x: 1500, y: 220 });
    // Presentation mouth stays completely empty — the OTHER empty-state branch (no formfieldMatchReport call at all).
    const html = await formHTML(page);
    expect(html).toContain('This wizard is empty');
    expect(errors, 'no uncaught error from the report path on a genuinely empty presentation').toEqual([]);
});
