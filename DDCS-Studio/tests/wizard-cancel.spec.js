import { test, expect } from '@playwright/test';

test('wizard transactional cancel reverts DOM inputs', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);

    // Open Pocket wizard
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('pocket'));
    
    // Wait for it to be visible
    const pocketWiz = page.locator('#wiz_pocket');
    await expect(pocketWiz).toBeVisible();

    // Check initial depth
    const depthInput = page.locator('#p_depth');
    await depthInput.fill('50');
    
    // Cancel the wizard using the close button
    await page.click('.wiz-close');
    await expect(pocketWiz).toBeHidden();

    // Reopen Pocket wizard
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('pocket'));
    await expect(pocketWiz).toBeVisible();

    // Depth should be reverted back to its default (not 50)
    const val = await depthInput.inputValue();
    expect(val).not.toBe('50');
});
