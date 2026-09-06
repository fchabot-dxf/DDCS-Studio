import { test, expect } from '@playwright/test';

/**
 * t2653 (owner-approved doorway pair, part 1) — DISCOVERABILITY: `user_root` ("Define Custom Wizard") is the
 * block EVERY authored wizard starts from — nothing else in the Wizard Layout category can be usefully
 * dragged until it exists. It was found sitting second-to-last in a 28-entry flyout, under ten handle types
 * (found only because t2637 had already read `userRoot.js` directly — reaching past the surface, not through
 * it). Fixed by reordering `wizards/ops/index.js`'s own PALETTE array — `buildToolbox()`'s per-category
 * bucket preserves PALETTE's own iteration order (`web/blocks/blockly/bridge.js:945`), so array position IS
 * flyout position; no new category, no toolbox chrome, category assignment unchanged.
 *
 * `usage_text` shares the category and sat immediately before `user_root`'s new position — moving user_root
 * past it too (not just past `layout`, the next FILE-adjacent Wizard Layout member) was required to make it
 * genuinely first, confirmed by actually building the toolbox rather than eyeballing the source array order.
 *
 * Driven through the REAL category click (`.blocklyToolboxCategory`, not a JS toolbox-API shortcut) — the
 * exact DOM a person clicks to open this flyout.
 */
test('user_root ("Define Custom Wizard") is the FIRST block in the real Wizard Layout flyout', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Toggle palette' }).click();
    await page.waitForTimeout(300);
    await page.locator('.blocklyToolboxCategory', { hasText: 'Wizard Layout' }).first().click();
    await page.waitForTimeout(300);

    const order = await page.evaluate(() => {
        const ws = window.__blkws;
        const flyout = ws.getFlyout ? ws.getFlyout() : ws.getToolbox().getFlyout();
        return flyout.getWorkspace().getTopBlocks(true).map((b) => b.type);
    });
    expect(order.length, 'the category actually opened with its real block set').toBeGreaterThan(1);
    expect(order[0], 'the wizard-starting block leads its own category, before every handle type').toBe('user_root');
});
