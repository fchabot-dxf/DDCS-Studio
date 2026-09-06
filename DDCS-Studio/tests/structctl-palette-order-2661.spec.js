import { test, expect } from '@playwright/test';

/**
 * t2661 — closing t2639's gap 6: the 8 corner/middle-specific structural-control blocks (structCtl.js's own
 * sc_probezfirst / sc_travelapproach / sc_travelshape / sc_wcs / sc_syncA / sc_corner / sc_probeseq /
 * sc_axisorder — all declared category:'Wizard Inputs', the SAME broad category as formfield/param_group/
 * param_table) used to sit BEFORE those generic, broadly-useful blocks in the PALETTE array — a person
 * authoring any OTHER wizard scrolled past 8 narrow, corner/middle-only blocks before reaching formfield.
 * PURE REORDER (wizards/ops/index.js's own PALETTE array position — buildToolbox's per-category bucket
 * preserves array order, the SAME mechanism/precedent t2653 used for user_root) — no new category, no new
 * chrome, category/colour unchanged. Driven through the real category click, matching t2653's own test.
 */
test('the 8 structural-control blocks sit AFTER formfield/param_group/param_table in the real Wizard Inputs flyout', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Toggle palette' }).click();
    await page.waitForTimeout(300);
    await page.locator('.blocklyToolboxCategory', { hasText: 'Wizard Inputs' }).first().click();
    await page.waitForTimeout(300);

    const order = await page.evaluate(() => {
        const ws = window.__blkws;
        const flyout = ws.getFlyout ? ws.getFlyout() : ws.getToolbox().getFlyout();
        return flyout.getWorkspace().getTopBlocks(true).map((b) => b.type);
    });
    expect(order.length, 'the category actually opened with its real block set').toBeGreaterThan(1);

    const structCtlTypes = order.filter((t) => t.startsWith('sc_'));
    expect(structCtlTypes.length, 'all 8 structural-control blocks are present in this category').toBe(8);

    const iFormfield = order.indexOf('formfield');
    const iParamGroup = order.indexOf('param_group');
    const firstStructCtl = Math.min(...structCtlTypes.map((t) => order.indexOf(t)));
    expect(iFormfield, 'formfield is actually in this category').toBeGreaterThan(-1);
    expect(iParamGroup, 'param_group is actually in this category').toBeGreaterThan(-1);
    expect(firstStructCtl, 'the first sc_* block comes AFTER formfield').toBeGreaterThan(iFormfield);
    expect(firstStructCtl, 'the first sc_* block comes AFTER param_group').toBeGreaterThan(iParamGroup);
});
