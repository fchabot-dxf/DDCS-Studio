import { test, expect } from '@playwright/test';

/**
 * t742 — CLOUD-CONNECT MUST BE REACHABLE, ESPECIALLY ON A PHONE.
 *
 * The original symptom: a fresh 390px boot had ZERO cloud affordances, so the account row was added to the header
 * quick menu. t1243 (user) retired that ☁ badge — cloud access lives in ONE place now, the workspace manager's
 * Local | Cloud tabs — so this spec is RE-ENCODED, not deleted: the requirement was never "a badge in the header",
 * it was "a person on a phone can find and use the cloud". That requirement now points at the Cloud tab, and these
 * tests fail if it stops being reachable there.
 */
// The menu's MARKUP is built by the same initHeaderPost() call that attaches its click handler, so waiting for a row
// of that markup is the honest "the button is live now" signal. Waiting on #hdrPostMenu merely EXISTING is not: the
// element is in index.html from the first byte, so a click can land before anything is listening and the menu never
// opens — which is exactly how this spec flaked under load (t1243).
const openMenu = async (page) => {
    await page.waitForFunction(() => window.ddcsStudio && document.querySelector('#hdrPostMenu .hdr-quick-head'), null, { timeout: 15000 });
    await page.locator('#hdrPostBtn').click();
    await page.waitForSelector('#hdrPostMenu:not([hidden])', { timeout: 6000 });
};

test('the retired ☁ badge is GONE from the header — one door, not two', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await openMenu(page);
    await expect(page.locator('#hdrPostMenu [data-cloud]'), 'the header no longer carries a cloud door').toHaveCount(0);
    await expect(page.locator('#hdrPostMenu .hq-pull-btn'), 'the ↧ PULL span stays — a controller read, not a cloud thing').toBeVisible();
});

test('DESKTOP: cloud lives in the workspace manager — sign-in is one click from the Cloud tab', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager);
    await page.evaluate(() => { ['ddcs_cloud_token', 'ddcs_cloud_provider', 'ddcs_cloud_email'].forEach((k) => localStorage.removeItem(k)); });
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('.wsm-place[data-place="cloud"]').click();
    const btn = page.locator('#wsmCloudSignIn');
    await expect(btn, 'ONE sign-in button, in the one place cloud lives now').toBeVisible();
    await expect(page.locator('#wsmCards button')).toHaveCount(1);
});

test('MOBILE 390px: the manager, its Cloud tab and the sign-in are all reachable AND tappable', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3211');
    await page.evaluate(() => { ['ddcs_cloud_token', 'ddcs_cloud_provider', 'ddcs_cloud_email'].forEach((k) => localStorage.removeItem(k)); });

    // the route a person actually takes on a phone: quick menu → Open → Cloud → Sign in
    await expect(page.locator('#hdrPostBtn'), 'the quick-menu button is reachable at 390px').toBeVisible();
    await openMenu(page);
    await page.locator('#hdrPostMenu [data-act="wsOpen"]').click();
    await expect(page.locator('#wsmOverlay')).toBeVisible();
    const tab = page.locator('.wsm-place[data-place="cloud"]');
    await expect(tab).toBeVisible();
    await tab.click();
    const btn = page.locator('#wsmCloudSignIn');
    await expect(btn, 'the sign-in is ON SCREEN at phone width — the t742 symptom was that it was not').toBeVisible();
    const b = await btn.boundingBox();
    expect(b.width, 'and big enough to tap').toBeGreaterThan(80);
    expect(b.x >= 0 && b.x + b.width <= 390, 'fully within the viewport').toBe(true);
    await page.screenshot({ path: 'scratchpad/account_row_mobile_742.png' });
});

test('CONNECTED: the Cloud tab shows WHO you are signed in as, and the way out', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager);
    await page.route('https://www.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) }));
    await page.evaluate(() => {
        localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google');
        localStorage.setItem('ddcs_cloud_email', 'maker@example.com');
    });
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('.wsm-place[data-place="cloud"]').click();
    const bar = page.locator('#wsmCloudBar');
    await expect(bar, 'the identity the header badge used to carry in a tooltip is stated here').toBeVisible();
    await expect(bar).toContainText('maker@example.com');
    await expect(bar.locator('#wsmCloudOut'), 'and the disconnect it carried').toBeVisible();

    await bar.locator('#wsmCloudOut').click();
    await expect(page.locator('#wsmCloudSignIn'), 'signing out returns to the one sign-in button').toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ddcs_cloud_token')), 'the token really is gone').toBeNull();
});
