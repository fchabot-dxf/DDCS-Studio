import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * t2359 (BACKLOG #34's own rider) — `cloudConnected()`-style checks used to mean ONLY "a token string exists",
 * true forever after the first successful connect even hours past the ~1h token's real expiry. `cloudAccount.js`'s
 * `getAccount()` now checks a stored expiry (written by `cloud/googleDrive.js`'s `connectGoogle`/`silentRefresh`
 * at every mint/refresh) where one exists, and `cloud/googleDrive.js` exports the same check as `isTokenValid()`
 * for `data/profileStore.js`'s own separate `cloudConnected()` (a genuinely different implementation, bypassing
 * `cloudAccount.js` entirely — established while auditing "who else calls the pattern").
 */

test.use({ viewport: { width: 1280, height: 900 } });

test('a token with NO stored expiry still reads as connected (no regression for pre-fix / desktop-path tokens)', async ({ page }) => {
    await page.goto('/');
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    const r = await page.evaluate(async () => {
        localStorage.setItem('ddcs_cloud_token', 'sometoken');
        localStorage.setItem('ddcs_cloud_provider', 'google');
        localStorage.removeItem('ddcs_cloud_token_expiry');
        const { getAccount } = await import('/ui/cloudAccount.js');
        return getAccount();
    });
    expect(r.connected, 'no expiry stored → still trust the token, unchanged from before this turn').toBe(true);
    expect(r.expired).toBe(false);
});

test('a token PAST its stored expiry reads as NOT connected — and as expired, not merely absent', async ({ page }) => {
    await page.goto('/');
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    const r = await page.evaluate(async () => {
        localStorage.setItem('ddcs_cloud_token', 'sometoken');
        localStorage.setItem('ddcs_cloud_provider', 'google');
        localStorage.setItem('ddcs_cloud_token_expiry', String(Date.now() - 1000));   // 1s in the past
        const { getAccount } = await import('/ui/cloudAccount.js');
        return getAccount();
    });
    expect(r.connected, 'a past-expiry token must NOT read as connected').toBe(false);
    expect(r.expired, 'and the reason is exposed as expired, not a bare false').toBe(true);
});

test('a token still WITHIN its stored expiry reads as connected', async ({ page }) => {
    await page.goto('/');
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    const r = await page.evaluate(async () => {
        localStorage.setItem('ddcs_cloud_token', 'sometoken');
        localStorage.setItem('ddcs_cloud_provider', 'google');
        localStorage.setItem('ddcs_cloud_token_expiry', String(Date.now() + 3600000));   // 1h from now
        const { getAccount } = await import('/ui/cloudAccount.js');
        return getAccount();
    });
    expect(r.connected).toBe(true);
    expect(r.expired).toBe(false);
});

test('the header chip distinguishes "sign in" from "session expired" using the validated state', async ({ page }) => {
    await page.goto('/');
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => {
        localStorage.setItem('ddcs_cloud_token', 'sometoken');
        localStorage.setItem('ddcs_cloud_provider', 'google');
        localStorage.setItem('ddcs_cloud_token_expiry', String(Date.now() - 1000));
    });
    await page.evaluate(async () => { const H = await import('/ui/headerAccount.js'); H.renderHeaderAccount(); });
    const label = await page.evaluate(() => document.querySelector('#hdrAccount .hdr-acct-btn')?.getAttribute('aria-label'));
    expect(label, 'an expired session gets its own label, not the generic first-time "Sign in"').toMatch(/expired/i);
});

test('profileStore\'s own separate cloudConnected() (bypasses cloudAccount.js) also honors the validated expiry', async ({ page }) => {
    await page.goto('/');
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    const r = await page.evaluate(async () => {
        const G = await import('/ui/cloud/googleDrive.js');
        localStorage.setItem('ddcs_cloud_token', 'sometoken');
        localStorage.setItem('ddcs_cloud_token_expiry', String(Date.now() - 1000));
        const expiredValid = G.isTokenValid();
        localStorage.setItem('ddcs_cloud_token_expiry', String(Date.now() + 3600000));
        const freshValid = G.isTokenValid();
        return { expiredValid, freshValid };
    });
    expect(r.expiredValid).toBe(false);
    expect(r.freshValid).toBe(true);
});
