import { test, expect } from '@playwright/test';

/**
 * t2661 — closing t2639's gap 7: "Save wizard…" also immediately inserts an instance into the CURRENT
 * program (the blocks used to author it were never removed from the canvas, and the canvas IS the open
 * program) — surprising, unannounced. RULED fix (owner's own copy rule, the same "the act acknowledges
 * itself" style t2657's sign-out notice already established): say so, naming what stayed and where. The
 * insert itself is UNCHANGED — this only makes it visible.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('Save wizard: a toast names that the authored blocks stay part of the open program', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp);
    await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); });

    await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
    await page.waitForSelector('#wiz_drill', { state: 'visible' });
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0 && window.ddcsSaveAsWizard);
    await page.waitForTimeout(400);

    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 8000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 't2661 insert notice pilot');
    await page.click('.blk-dev-savedlg .blk-dev-save');

    await expect(page.locator('.toast'), 'the notice names the canvas/program fact, not just "Saved"').toContainText('stay part of the program', { timeout: 3000 });

    // NOT a behaviour change: the drill blocks used to author it are STILL on the canvas afterward.
    const stillThere = await page.evaluate(() => window.__blkws.getAllBlocks(false).length > 0);
    expect(stillThere, 'the insert itself is unchanged — nothing was cleared by this fix').toBe(true);

    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
