import { test, expect } from '@playwright/test';

/**
 * t2539 (BACKLOG #71) — the stale SEARCH FLYOUT silently intercepted the very next click after a block was
 * dragged out of it: `.blk-search`'s own `runSearch()` only ever hides the flyout when the search box is
 * explicitly cleared, and dragging a block out of it never did that — so its own `path.blocklyFlyoutBackground`
 * stayed on top of the canvas, swallowing whatever click landed inside its area next, with NO error and NO
 * visual signal. MEASURED to be real for a human, not an automation artifact: an A/B test driving BOTH an
 * instant teleport-click (matching this session's own original test-harness shape) AND a click preceded by
 * realistic, incremental, hover-then-click pointer travel reproduced the SAME interception either way.
 *
 * FIX: `blocksApp.js`'s own workspace change-listener now clears `.blk-search` (the exact action its own ✕
 * button already performs) the instant a block lands on the MAIN workspace (`e.type === 'create'`) — making
 * the failure IMPOSSIBLE, not merely less likely, since it no longer depends on remembering to clear search
 * before the next click at all.
 *
 * Companion fix, free (BACKLOG #71's own t2537 finding, reduction 3): the `ATOMTYPE` must-match picker's own
 * empty-state message now names the ordering constraint directly, where an author actually meets it — not
 * only in a WORK-LOG.
 */

test.use({ viewport: { width: 2600, height: 1000 } });

test('a block dragged out of a SEARCH-triggered flyout auto-closes it -- the very next click reaches its real target, not the stale flyout', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    const s = page.locator('.blk-search');
    await s.click();
    await s.fill('form field');
    await page.waitForTimeout(200);

    const grab = await page.evaluate(() => {
        const ws = window.__blkws;
        const fws = ws.getToolbox().getFlyout().getWorkspace();
        const blk = fws.getAllBlocks().find((b) => b.type === 'formfield');
        const root = blk.getSvgRoot();
        const target = root.querySelector('text.blocklyText, .blocklyText') || root;
        const rect = target.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    const off = await page.evaluate(() => {
        const ws = window.__blkws;
        const fws = ws.getToolbox().getFlyout().getWorkspace();
        const blk = fws.getAllBlocks().find((b) => b.type === 'formfield');
        const root = blk.getSvgRoot();
        const grabRect = (root.querySelector('text.blocklyText, .blocklyText') || root).getBoundingClientRect();
        const grabPt = { x: grabRect.x + grabRect.width / 2, y: grabRect.y + grabRect.height / 2 };
        const conn = blk.previousConnection || blk.outputConnection;
        const o = conn.getOffsetInBlock();
        const blockRect = root.getBoundingClientRect();
        const connScreen = { x: blockRect.left + o.x * fws.scale, y: blockRect.top + o.y * fws.scale };
        return { dx: grabPt.x - connScreen.x, dy: grabPt.y - connScreen.y };
    });
    const dropX = 1900 + off.dx, dropY = 400 + off.dy;

    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(grab.x + 30, grab.y + 20, { steps: 5 });
    await page.mouse.move(dropX, dropY, { steps: 20 });
    await page.mouse.move(dropX, dropY, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const placed = await page.evaluate(() => window.__blkws.getAllBlocks(false).some((b) => b.type === 'formfield'));
    expect(placed, 'the drag itself succeeded -- this is testing a real, successful placement').toBe(true);

    // THE ASSERTION: the search box is now empty and the flyout reports itself hidden -- the fix's own effect,
    // not inferred from a downstream click succeeding alone.
    const searchVal = await s.inputValue();
    expect(searchVal, 'the search box was cleared automatically the instant the block landed').toBe('');
    const flyoutVisible = await page.evaluate(() => {
        const fl = window.__blkws.getToolbox().getFlyout();
        return fl.isVisible ? fl.isVisible() : null;
    });
    expect(flyoutVisible, 'the flyout itself reports closed').toBe(false);

    // THE REAL-SYMPTOM CHECK: click the just-placed block's own PARAM field with NO defensive clearSearch() of
    // any kind -- the exact scenario that used to silently fail (t2509/t2523's own documented workaround).
    const fieldRect = await page.evaluate(() => {
        const ws = window.__blkws;
        const blk = ws.getAllBlocks(false).find((b) => b.type === 'formfield');
        const f = blk.getField('PARAM');
        const group = f.fieldGroup_ || f.getSvgRoot();
        const el = (group && group.querySelector('text')) || (f.getClickTarget_ && f.getClickTarget_()) || group;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(fieldRect.x, fieldRect.y);
    await page.waitForTimeout(150);
    const inputOpened = await page.evaluate(() => !!document.querySelector('.blocklyHtmlInput'));
    expect(inputOpened, 'the click reached the REAL field, not a stale flyout overlay').toBe(true);
    await page.keyboard.press('Escape');
});

test('ATOMTYPE picker empty state names the ordering fix directly, where an author actually hits it', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    async function searchFor(text) {
        const s = page.locator('.blk-search');
        await s.click();
        await s.fill(text);
        await page.waitForTimeout(200);
    }
    async function dragTo(type, targetPt) {
        const grab = await page.evaluate((t) => {
            const ws = window.__blkws;
            const fws = ws.getToolbox().getFlyout().getWorkspace();
            const blk = fws.getAllBlocks().find((b) => b.type === t);
            const root = blk.getSvgRoot();
            const target = root.querySelector('text.blocklyText, .blocklyText') || root;
            const rect = target.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }, type);
        const off = await page.evaluate((t) => {
            const ws = window.__blkws;
            const fws = ws.getToolbox().getFlyout().getWorkspace();
            const blk = fws.getAllBlocks().find((b) => b.type === t);
            const root = blk.getSvgRoot();
            const grabRect = (root.querySelector('text.blocklyText, .blocklyText') || root).getBoundingClientRect();
            const grabPt = { x: grabRect.x + grabRect.width / 2, y: grabRect.y + grabRect.height / 2 };
            const conn = blk.previousConnection || blk.outputConnection;
            const o = conn.getOffsetInBlock();
            const blockRect = root.getBoundingClientRect();
            const connScreen = { x: blockRect.left + o.x * fws.scale, y: blockRect.top + o.y * fws.scale };
            return { dx: grabPt.x - connScreen.x, dy: grabPt.y - connScreen.y };
        }, type);
        const dX = targetPt.x + off.dx, dY = targetPt.y + off.dy;
        await page.mouse.move(grab.x, grab.y);
        await page.mouse.down();
        await page.mouse.move(grab.x + 30, grab.y + 20, { steps: 5 });
        await page.mouse.move(dX, dY, { steps: 20 });
        await page.mouse.move(dX, dY, { steps: 2 });
        await page.mouse.up();
        await page.waitForTimeout(200);
    }

    await searchFor('Define Custom Wizard');
    await dragTo('user_root', { x: 1900, y: 220 });
    const presMouth = await page.evaluate(() => {
        const ws = window.__blkws;
        const blk = ws.getAllBlocks(false).find((b) => b.type === 'user_root');
        const inp = blk.inputList.find((i) => i.name === 'PRESENTATION');
        const off = inp.connection.getOffsetInBlock();
        const rect = blk.getSvgRoot().getBoundingClientRect();
        return { x: rect.left + off.x * ws.scale, y: rect.top + off.y * ws.scale };
    });
    await searchFor('form field');
    await dragTo('formfield', presMouth);

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

    // BINDMODE -> Op Param first -- the ATOMTYPE field only exists in that mode (the default, Assign Var,
    // shows matchvar instead).
    await centerOn('formfield');
    const bindRect = await fieldRect('formfield', 'BINDMODE');
    await page.mouse.click(bindRect.x, bindRect.y);
    await page.waitForTimeout(200);
    await page.locator('.blocklyMenuItem', { hasText: 'Op Param' }).first().click({ timeout: 3000 });
    await page.waitForTimeout(150);

    // Open the ATOMTYPE picker BEFORE any atom exists anywhere on this canvas -- the exact t2537 scenario.
    await centerOn('formfield');
    const rect = await fieldRect('formfield', 'ATOMTYPE');
    await page.mouse.click(rect.x, rect.y);
    await page.waitForTimeout(250);
    const guidance = page.getByText('place the atom block this field should bind to FIRST');
    await expect(guidance, 'names the fix directly, where the author actually meets it').toBeVisible();
    await page.keyboard.press('Escape');
});
