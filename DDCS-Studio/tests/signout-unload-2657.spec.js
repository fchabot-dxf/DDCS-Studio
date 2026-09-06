import { test, expect } from '@playwright/test';

/**
 * t2657 (BACKLOG #82, owner-ruled 2026-09-05, found live on their own phone) — SIGN-OUT UNLOADS THE WORKSPACE.
 * Before this turn, signing out of the Google account (the header chip, or the Workspace Manager's Cloud tab)
 * cleared only the cloud token — the loaded workspace (machine config, envelope, offsets, custom wizards,
 * G-code) stayed fully open. On a shared/borrowed device the next person holds the previous user's machine.
 *
 * THE FOUR RULED EDGES, each its own test below:
 *   1. unsaved changes PROMPT TO SAVE first (the shared confirmDiscardWithMessage gate, ui/workspaceManager.js)
 *      — and the same Discard path proves the unload itself: workspace data (a custom wizard) is CLEARED while
 *      per-viewer chrome (pane fold state) SURVIVES
 *   2. a "Signed out" notice fires once the unload completes (read-once marker across the reload it needs)
 *   3. ⛔ token EXPIRY alone never unloads — only the explicit act does
 *
 * The SILENT test seeds NOTHING: writing straight into a BACKUP_STORES localStorage key (bypassing the app's
 * own write path) itself diverges the workspace from its just-taken baseline and makes it read dirty — so
 * "nothing to lose" and "seeded data exists" are mutually exclusive setups, not two facts to prove at once.
 *
 * Sign-out reloads the page (ui/signOutFlow.js, matching the SAME pattern a real workspace Open already uses),
 * so every assertion after triggering it re-reads localStorage directly rather than trusting in-memory state.
 */
async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
}

/** Fake a connected Google account — the exact keys cloudAccount.js's own getAccount() reads. */
async function fakeSignedIn(page) {
    await page.evaluate(() => {
        localStorage.setItem('ddcs_cloud_token', 'FAKE_TOKEN');
        localStorage.setItem('ddcs_cloud_provider', 'google');
        localStorage.setItem('ddcs_cloud_email', 'pilot@example.com');
        localStorage.removeItem('ddcs_cloud_token_expiry');   // no expiry = connected, matches a real un-expired session
    });
}

async function seedWorkspaceData(page) {
    await page.evaluate(() => {
        // a workspace-data row (custom wizards) — must be CLEARED by sign-out. NOTE: app.js's own boot re-seeds
        // the FACTORY default ported ops on every load (seedDefaultPortedUserOps) — that reseed is itself part
        // of "pristine" (a genuinely fresh visitor's first boot does the same), so the assertion below checks
        // that THIS planted, non-factory entry is gone, not that the whole key reads null.
        localStorage.setItem('ddcs_user_ops', JSON.stringify([{ opType: 'user_pilot_2657', label: 'Pilot 2657', panel: 'form3d', template: [], bindings: [] }]));
        // a perViewer row (pane fold state) — must SURVIVE sign-out
        localStorage.setItem('ddcs_panes', JSON.stringify({ pilotMarker2657: true }));
    });
}

/** Is the planted, non-factory 'user_pilot_2657' wizard still present in localStorage's ddcs_user_ops? */
const hasPilotOp = (page) => page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('ddcs_user_ops') || '[]')).some((d) => d && d.opType === 'user_pilot_2657'); }
    catch (_) { return false; }
});

test('SILENT: signing out on an untouched, just-booted workspace unloads immediately, no prompt', async ({ page }) => {
    await ready(page);
    await page.waitForTimeout(2500);   // let the watermark-settle poll finish (fileSaveState.js) — matches replace-confirm-2184's own precedent
    await fakeSignedIn(page);
    // deliberately NO seedWorkspaceData here: writing straight to a BACKUP_STORES key (bypassing the app's own
    // write path) diverges it from its just-taken baseline and makes isWorkspaceDirtyToFile() true — the exact
    // opposite of what "silent, nothing to lose" is testing. That combined case belongs to the Discard test below.

    // t2657 — signOutAndUnload() ends in location.reload(), which (for the SILENT, nothing-to-lose path) can
    // fire fast enough to race Playwright's own waitForNavigation listener registration (measured: a real,
    // reproducible timeout, not a one-off flake). Synchronize on a PRODUCT-OBSERVABLE signal instead: the
    // "Signed out" toast can only paint after the reload's own fresh boot ran announceSignedOutIfPending(), so
    // waiting for it proves the reload+reboot completed without depending on Playwright's navigation-event timing.
    await page.evaluate(() => { import('/ui/signOutFlow.js').then((m) => m.signOutAndUnload()); });
    await expect(page.locator('.wsm-3way'), 'nothing changed since boot — no prompt should ever appear').toHaveCount(0);
    await expect(page.locator('.toast'), 'the reload completed — the notice only ever paints post-reload').toContainText('Signed out', { timeout: 15000 });

    const token = await page.evaluate(() => localStorage.getItem('ddcs_cloud_token'));
    expect(token, 'the cloud account is signed out').toBeNull();
});

test('THE NOTICE: "Signed out" appears once, right after the reload the unload needed', async ({ page }) => {
    await ready(page);
    await page.waitForTimeout(1500);
    await fakeSignedIn(page);

    await page.evaluate(() => { import('/ui/signOutFlow.js').then((m) => m.signOutAndUnload()); });
    await expect(page.locator('.toast'), 'the notice fires on the very next boot after sign-out').toContainText('Signed out', { timeout: 15000 });

    // read-once: reloading AGAIN (a plain refresh, not a sign-out) must not repeat it.
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.waitForTimeout(500);
    await expect(page.locator('.toast'), 'a plain refresh is not a sign-out — the notice does not repeat').toHaveCount(0);
});

test('PRESENT: unsaved workspace changes prompt first — Cancel aborts, nothing is touched', async ({ page }) => {
    await ready(page);
    await page.waitForTimeout(1500);
    await fakeSignedIn(page);
    await seedWorkspaceData(page);
    await page.evaluate(() => window.openSettings && window.openSettings({ group: 'lookfeel', panel: 'set_tab_appearance' }));
    await page.waitForSelector('#set_theme', { timeout: 6000 });
    await page.selectOption('#set_theme', 'organic');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const dirty = await page.evaluate(() => window.ddcsFileSaveState.isDirty());
    expect(dirty, 'sanity: the theme change marked the workspace dirty').toBe(true);

    const pending = page.evaluate(async () => { const m = await import('/ui/signOutFlow.js'); return m.signOutAndUnload(); });
    await expect(page.locator('.wsm-3way'), 'the SAME unsaved gate as opening a workspace fires here too').toBeVisible({ timeout: 3000 });
    await page.locator('.wsm-3way [data-w3="cancel"]').click();
    expect(await pending, 'Cancel resolves false — the caller does nothing further').toBe(false);

    const token = await page.evaluate(() => localStorage.getItem('ddcs_cloud_token'));
    expect(token, 'Cancel means still signed in').not.toBeNull();
    expect(await hasPilotOp(page), 'Cancel means the workspace is untouched').toBe(true);
});

test('PRESENT: unsaved workspace changes, Discard proceeds — the unload still happens', async ({ page }) => {
    await ready(page);
    await page.waitForTimeout(1500);
    await fakeSignedIn(page);
    await seedWorkspaceData(page);
    await page.evaluate(() => window.openSettings && window.openSettings({ group: 'lookfeel', panel: 'set_tab_appearance' }));
    await page.waitForSelector('#set_theme', { timeout: 6000 });
    await page.selectOption('#set_theme', 'organic');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    page.evaluate(() => { import('/ui/signOutFlow.js').then((m) => m.signOutAndUnload()); });
    await expect(page.locator('.wsm-3way')).toBeVisible({ timeout: 3000 });
    await page.locator('.wsm-3way [data-w3="discard"]').click();
    await expect(page.locator('.toast'), 'the reload completed — Discard let the unload proceed').toContainText('Signed out', { timeout: 15000 });

    const state = await page.evaluate(() => ({ token: localStorage.getItem('ddcs_cloud_token'), panes: localStorage.getItem('ddcs_panes') }));
    expect(state.token, 'Discard proceeds — signed out').toBeNull();
    expect(await hasPilotOp(page), 'Discard proceeds — the planted custom wizard is cleared').toBe(false);
    expect(state.panes, 'per-viewer chrome (pane fold state) SURVIVES — it is the viewer\'s, not the workspace\'s').not.toBeNull();
    expect(JSON.parse(state.panes).pilotMarker2657, 'the SAME fold state, untouched').toBe(true);
});

test('⛔ TOKEN EXPIRY ALONE NEVER UNLOADS — an expired session is ignorance, not a departure', async ({ page }) => {
    await ready(page);
    await page.waitForTimeout(1500);
    await fakeSignedIn(page);
    await seedWorkspaceData(page);
    // simulate a token that expired naturally (no explicit sign-out click ever happened)
    await page.evaluate(() => localStorage.setItem('ddcs_cloud_token_expiry', String(Date.now() - 1000)));

    // a plain reload is what a real app restart / tab reopen looks like for an expired session
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.waitForTimeout(500);

    const panes = await page.evaluate(() => localStorage.getItem('ddcs_panes'));
    // the token itself is left in place (getAccount() derives `expired` from the timestamp, it does not clear
    // the key) — the load-bearing claim is that the WORKSPACE was never touched by mere expiry.
    expect(await hasPilotOp(page), 'an expired token does not clear workspace data — only an explicit sign-out does').toBe(true);
    expect(panes, 'an expired token does not touch pane state either').not.toBeNull();
    await expect(page.locator('.toast'), 'no "Signed out" notice — nothing was signed out, it just lapsed').toHaveCount(0);
    // the header shows the established expired-session label (t2359), proving expiry IS detected — just not acted on destructively
    await expect(page.locator('.hdr-acct-btn')).toHaveAttribute('aria-label', /expired/i);
});
