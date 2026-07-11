import { test, expect } from '@playwright/test';

/**
 * t742 — THE HEADER ACCOUNT ROW. The header quick-menu (#hdrPostBtn → #hdrPostMenu) gains a one-line ACCOUNT row in the
 * Profile section showing cloud state at a glance ("☁ Cloud: not connected · Connect" / "☁ <email>" when connected). Tap
 * opens the SAME connect flow (renderCloudLogin) Settings + the Projects drawer use — NO second connect implementation.
 * Context: cloud-connect was invisible on mobile (zero affordances on a fresh 390px boot). Emit untouched (header UI only).
 */

// initHeaderPost wires the quick-menu click handler ASYNC on boot — window.ddcsStudio can exist before it's wired, so
// clicking too early no-ops. Poll (t710-style, no fixed sleep): click only when the menu isn't already open, retry until
// the row is actually visible — robust under -workers contention.
const openMenu = async (page) => {
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 20000 });
    await expect(async () => {
        const open = await page.evaluate(() => { const m = document.getElementById('hdrPostMenu'); return !!(m && !m.hidden && m.querySelector('[data-cloud]')); });
        if (!open) await page.locator('#hdrPostBtn').click();
        await expect(page.locator('#hdrPostMenu [data-cloud]')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15000 });
};

test('DESKTOP: the account row is in the header menu (not-connected state) + tap opens the SHARED cloud flow', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForSelector('#hdrPostBtn', { timeout: 8000 });
    // ensure a fresh (not-connected) state
    await page.evaluate(() => { ['ddcs_cloud_token', 'ddcs_cloud_provider', 'ddcs_cloud_email', 'ddcs_cloud_name'].forEach((k) => localStorage.removeItem(k)); });
    await openMenu(page);
    const row = page.locator('#hdrPostMenu [data-cloud]');
    await expect(row, 'the account row is visible in the header menu').toBeVisible();
    await expect(row, 'not-connected state is stated at a glance').toContainText('not connected');

    // tap → the SHARED connect flow opens (a modal hosting renderCloudLogin — its .cloud-login component)
    await row.click();
    await page.waitForSelector('.cloud-account-ov', { timeout: 12000 });
    await expect(page.locator('.cloud-account-ov .cloud-login'), 'the modal hosts the SHARED renderCloudLogin component (no duplicate connect impl)').toBeVisible();
    await expect(page.locator('.cloud-account-ov .cloud-connect').first(), 'the shared provider-connect button is present').toBeVisible();
    await page.screenshot({ path: 'scratchpad/account_row_desktop_742.png' });
    await page.locator('.cloud-account-ov .cloud-done').click();
    await expect(page.locator('.cloud-account-ov')).toHaveCount(0);
});

test('MOBILE 390px: the account row is visible in the header menu + tap opens the flow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3211');
    await page.waitForSelector('#hdrPostBtn', { timeout: 8000 });
    await page.evaluate(() => { ['ddcs_cloud_token', 'ddcs_cloud_provider', 'ddcs_cloud_email', 'ddcs_cloud_name'].forEach((k) => localStorage.removeItem(k)); });
    await expect(page.locator('#hdrPostBtn'), 'the header quick-menu button is reachable at 390px').toBeVisible();
    await openMenu(page);
    await expect(page.locator('#hdrPostMenu [data-cloud]'), 'the account row is visible at 390px (cloud-connect was invisible on mobile before)').toBeVisible();
    await page.locator('#hdrPostMenu [data-cloud]').click();
    await page.waitForSelector('.cloud-account-ov', { timeout: 12000 });
    await expect(page.locator('.cloud-account-ov .cloud-login')).toBeVisible();
    await page.screenshot({ path: 'scratchpad/account_row_mobile_742.png' });
});

test('CONNECTED state: the row shows the account identity', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForSelector('#hdrPostBtn', { timeout: 8000 });
    // simulate a connected account (the ONE source cloudAccount.getAccount reads)
    await page.evaluate(() => { localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google'); localStorage.setItem('ddcs_cloud_email', 'maker@example.com'); });
    await openMenu(page);
    await expect(page.locator('#hdrPostMenu [data-cloud]'), 'the connected state shows the account email identity').toContainText('maker@example.com');
    await page.evaluate(() => { ['ddcs_cloud_token', 'ddcs_cloud_provider', 'ddcs_cloud_email', 'ddcs_cloud_name'].forEach((k) => localStorage.removeItem(k)); });
});
