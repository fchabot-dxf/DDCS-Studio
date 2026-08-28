import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * t2359 — REMOVE THE PRESET FEATURE (BACKLOG #34, ruled by the owner 2026-08-27). Values for a job are a
 * PROJECT (which can be one op); a new identity is a CUSTOM WIZARD fork; presets were the hand-rolled July
 * middle ground (t794) covered from both sides — a duplicate concept. Removing it also kills the wizard-open
 * Google sign-in AT THE ROOT: t2343 traced the trigger to `mountPresetRow`'s background Drive check running on
 * every wizard open (`wizardManager.js`'s own `open()`) — `listTemplates` → `cloudRead` → `googleDrive.js`'s
 * `ensureRoot()` → `api()`'s 401 retry → `silentRefresh()`, which can visibly fail into a GIS "Choose an
 * account" chooser when the stored token has actually expired (the exact state a RETURNING user, i.e. anyone
 * who has ever connected before, sits in for most of every session). The fix is not deferring or fail-quieting
 * that check — the feature occupies a gap that doesn't exist, so it is deleted, not patched.
 *
 * Removed whole: `ui/wizardTemplates.js` (mountPresetRow, listTemplates/saveTemplate/deleteTemplate,
 * cloudRead/cloudFileRef/cloudWrite, cloudConnected, the templates popover) and its three call sites in
 * `wizardManager.js` (`open()`'s mount + two `close()`/`open()` popover-close calls). `backup.js`'s own
 * `ddcs_tpl_*` registry row is DELIBERATELY left alone — per the standing ruling, orphaned stored data (any
 * preset a user saved before this turn) is harmless and continuing to round-trip it through backup/restore is
 * not a migration, just not actively destroying it.
 */

test.use({ viewport: { width: 1280, height: 900 } });

test('every wizard type opens clean, returning-user account state, ZERO Google network calls or auth errors', async ({ page }) => {
    // narrow to the actual OAuth/Drive surface (t2343's own trace) — NOT fonts.googleapis.com, an unrelated
    // legitimate asset fetch that happens to share the googleapis.com host.
    const blockedCalls = [];
    await page.route(/^https:\/\/accounts\.google\.com|^https:\/\/www\.googleapis\.com|gsi\/client/, (route) => {
        blockedCalls.push(route.request().url());
        route.abort();
    });
    // scoped to Google/auth-related failures — a bare "any console error" check picks up unrelated, pre-existing
    // noise in this headless harness (page.reload()'s own module-fetch aborts, /api/config /api/descriptor 404s
    // from gateway-polling code with no gateway running here — none of it caused by this turn's own changes).
    const authErrors = [];
    const isAuthNoise = (s) => /google|gsi|oauth|drive/i.test(s);
    page.on('console', (m) => { if (m.type() === 'error' && isAuthNoise(m.text())) authErrors.push(m.text()); });
    page.on('pageerror', (e) => { if (isAuthNoise(e.message)) authErrors.push('pageerror: ' + e.message); });

    await page.goto('/');
    // simulate a RETURNING user with a stale-but-"connected" Google account (the exact state t2343 traced)
    await page.evaluate(() => {
        localStorage.setItem('ddcs_cloud_token', 'stale-token-simulating-expired-session');
        localStorage.setItem('ddcs_cloud_provider', 'google');
    });
    await page.reload();
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    // let any BOOT-time trigger (the header avatar's backfillIdentity — BACKLOG #34's own named, separate,
    // once-per-load mechanism, NOT this turn's fix) settle before the reset below
    await page.waitForTimeout(300);

    const types = await page.evaluate(async () => {
        const { getLibrary } = await import('/blocks/wizardLibrary.js');
        const out = [];
        for (const g of getLibrary().groups || []) for (const e of g.items || []) out.push(e.opensAs || e.type);
        return [...new Set(out)].filter(Boolean);
    });
    expect(types.length, 'the wizard library is not empty (a vacuous loop would prove nothing)').toBeGreaterThan(20);

    blockedCalls.length = 0;   // reset — everything from here on is attributable to the wizard-open loop specifically
    authErrors.length = 0;

    for (const t of types) {
        await page.evaluate((type) => window.openWiz(type), t);
        await page.waitForTimeout(100);
    }

    expect(blockedCalls, `no Google network call should ever be attempted from opening a wizard; saw: ${JSON.stringify(blockedCalls)}`).toHaveLength(0);
    expect(authErrors, `no auth-related console errors while opening every wizard: ${JSON.stringify(authErrors)}`).toHaveLength(0);
});

test('the preset feature is genuinely gone — no row, no popover, no leftover module', async ({ page }) => {
    await page.goto('/');
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => window.openWiz('drill'));
    await page.waitForSelector('#wiz_drill', { state: 'visible' });
    const r = await page.evaluate(() => ({
        presetRow: document.querySelector('.wiz-preset-row'),
        templatesPop: document.querySelector('.wiz-tpl-pop'),
    }));
    expect(r.presetRow, 'no preset row anywhere in the DOM').toBeNull();
    expect(r.templatesPop, 'no templates popover anywhere in the DOM').toBeNull();

    const moduleGone = await page.evaluate(async () => {
        try { await import('/ui/wizardTemplates.js'); return false; } catch (_) { return true; }
    });
    expect(moduleGone, 'ui/wizardTemplates.js no longer exists').toBe(true);
});
