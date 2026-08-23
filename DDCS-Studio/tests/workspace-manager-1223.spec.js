import { test, expect } from '@playwright/test';

/**
 * t1223 TURN A — THE WORKSPACE MANAGER.
 *
 * All workspace management lives in ONE modal reached from the quick menu's two primary buttons. The top half is THIS
 * workspace (name, state, what changed since the last save, Save / Save As / Duplicate); the bottom half is the
 * granted folder, every .ddcs in it as a card that leads with the ENVELOPE. Opening is always the WHOLE file, and an
 * unsaved buffer gets ONE prompt instead of a silent download.
 *
 * The folder half is driven with a STUBBED directory handle — the same shape the File System Access API hands back —
 * so the card rendering under test is the real one, reading real .ddcs bytes, without an OS dialog.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const ddcs = (name, { x, y, z }, controllerId, date) => ({
    name: name + '.ddcs',
    body: JSON.stringify({
        kind: 'ddcs.backup', v: 1, app: 'test', date,
        stores: { machine: { name, controllerId }, settings: { machine: { x, y, z, show: true } } },
    }),
});

const FILES = [
    ddcs('m350-shop', { x: 756, y: -776, z: -120 }, 'ddcs-expert-m350', '2026-07-20T10:00:00.000Z'),
    ddcs('bench-router', { x: 300, y: 200, z: -80 }, 'ddcs-v41', '2026-07-24T10:00:00.000Z'),
];

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openWorkspaceManager && window.ddcsWorkspaceDelta && window.ddcsFileSaveState);   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
    // the quick menu is wired by a separate module — wait for the button AND its menu, or the first click races boot
    await page.waitForFunction(() => document.getElementById('hdrPostBtn') && document.getElementById('hdrPostMenu'));
    await page.evaluate(() => { window.__ddcsNoReload = true; });   // the open path reloads in the app; keep the test page
}

// hand the manager a fake granted folder holding real .ddcs bytes
async function grantFolder(page, files) {
    await page.evaluate((fs) => {
        window.showDirectoryPicker = async () => ({
            kind: 'directory', name: 'Workspaces',
            queryPermission: async () => 'granted',
            async *entries() {
                for (const f of fs) {
                    yield [f.name, { kind: 'file', name: f.name, getFile: async () => new File([f.body], f.name) }];
                }
            },
        });
    }, files);
}

test('the quick menu carries SAVE and OPEN as primary buttons; Open lands in the manager, Save writes in place', async ({ page }) => {
    await boot(page);
    await page.locator('#hdrPostBtn').click();
    // t2184 — FOUR `.hq-ws-row` pairs exist now (Workspace/G-code/Project/Reference); scope to the ONE that
    // actually holds Save/Open (the Workspace section's own pair), not just any `.hq-ws-row`.
    const row = page.locator('#hdrPostMenu .hq-ws-row:has([data-act="wsSave"])');
    await expect(row, 'the workspace row exists').toBeVisible({ timeout: 8000 });
    await expect(row.locator('[data-act="wsSave"]')).toBeVisible();
    await expect(row.locator('[data-act="wsOpen"]')).toBeVisible();

    await row.locator('[data-act="wsOpen"]').click();
    await expect(page.locator('#wsmOverlay'), 'Open lands in the manager — browsing genuinely needs a picker').toBeVisible();
    await page.locator('#wsmOverlay .wsm-x').click();

    // t2196 (amendment 2, bug 2) — Save no longer opens the manager: it used to (this test asserted exactly that,
    // "one surface, two entry points"), which a live human report caught as the row's own label/tooltip breaking
    // its own promise ("Save", no ellipsis — "write it now", not "let me review first"). The full write-in-place
    // mechanics (a real FSA handle, byte-for-byte, no dialog) are covered end-to-end in
    // workspace-save-open-1225.spec.js, which already owns the fake-filesystem plumbing this needs; here we only
    // prove the WIRING — the click reaches the direct-save door, not the modal.
    let saveCalls = 0;
    await page.evaluate(() => { window.__origWsSave = window.ddcsFileSaveState.save; window.ddcsFileSaveState.save = () => { window.__wsSaveCalls = (window.__wsSaveCalls || 0) + 1; }; });
    await page.click('#hdrPostBtn');
    await page.locator('#hdrPostMenu [data-act="wsSave"]').click();
    saveCalls = await page.evaluate(() => window.__wsSaveCalls || 0);
    expect(saveCalls, 'the click reached the direct-save door').toBe(1);
    await expect(page.locator('#wsmOverlay'), 'and did NOT open the manager').toHaveCount(0);
    await page.evaluate(() => { window.ddcsFileSaveState.save = window.__origWsSave; });
});

test('the top half names THIS workspace, shows the per-store DELTA, and offers Save / Save As / Duplicate', async ({ page }, testInfo) => {
    await boot(page);
    // save once so there IS a baseline, then change one declared store so the delta has something true to report
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('m350-shop.ddcs'); });
    await page.evaluate(() => { localStorage.setItem('ddcs_tpl_zzz_wsm', JSON.stringify([{ n: 1 }])); });

    await page.evaluate(() => window.openWorkspaceManager('save'));
    const cur = page.locator('#wsmCurrent');
    await expect(cur).toContainText('m350-shop.ddcs');
    await expect(cur.locator('.wsm-state')).toHaveText(/Unsaved changes/);
    await expect(cur.locator('[data-wsm="save"]')).toBeVisible();
    await expect(cur.locator('[data-wsm="saveas"]')).toBeVisible();
    await expect(cur.locator('[data-wsm="duplicate"]')).toBeVisible();

    // the DELTA is per declared store, and it marks the one that actually changed
    const changed = await cur.locator('.wsm-drow.is-chg').allTextContents();
    const unchanged = await cur.locator('.wsm-drow:not(.is-chg)').allTextContents();
    expect(changed.join(' '), 'the store that changed is marked changed').toMatch(/Wizard presets/);
    // the point of a PER-STORE delta is that it discriminates — some rows must be left unmarked, or it is just
    // "something changed" wearing a list. (Not "exactly one": the app legitimately writes other stores while running.)
    expect(unchanged.length, 'and untouched stores are NOT marked').toBeGreaterThan(0);
    await page.locator('#wsmOverlay .wsm-modal').screenshot({ path: testInfo.outputPath('wsm-current-delta.png') });
});

test('the folder half is an OS-style file panel listing every .ddcs, read from the files themselves', async ({ page }, testInfo) => {
    await boot(page);
    await grantFolder(page, FILES);
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('#wsmPickFolder').click();

    const cards = page.locator('#wsmCards .wsm-fp-row');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('#wsmFolderPath')).toHaveText(/Workspaces/);

    // an OS-style file PANEL with a column header; the ENVELOPE is the strongest column, read from the FILE's settings
    await expect(page.locator('#wsmCards .wsm-fp-head')).toContainText(/Envelope/i);
    const first = cards.first();
    // t1231 — AS DECLARED, signs included: the sign is the home-direction declaration, never cosmetic.
    // t1243 — and with the AXIS LETTERS, from the same one formatter every surface reads.
    await expect(first.locator('.wsm-c-env')).toHaveText('X 300 Y 200 Z -80');   // newest saved first
    await expect(first.locator('.wsm-c-ctrl')).toHaveText(/V4\.1/);
    await expect(first.locator('.wsm-c-name')).toContainText('bench-router');
    await expect(cards.nth(1).locator('.wsm-c-env'), 'the other machine, its own envelope + its own home ends').toHaveText('X 756 Y -776 Z -120');
    await page.locator('#wsmOverlay .wsm-modal').screenshot({ path: testInfo.outputPath('wsm-folder-cards.png') });
});

test('opening with UNSAVED work asks ONCE (Save and continue / Discard / Cancel) — no silent download', async ({ page }, testInfo) => {
    await boot(page);
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('m350-shop.ddcs'); });
    await page.evaluate(() => { localStorage.setItem('ddcs_tpl_zzz_wsm2', JSON.stringify([{ n: 2 }])); window.ddcsFileSaveState.refresh(); });
    expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'the buffer really is dirty').toBe(true);

    await grantFolder(page, FILES);
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('#wsmPickFolder').click();
    await expect(page.locator('#wsmCards .wsm-fp-row')).toHaveCount(2);

    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.locator('#wsmCards .wsm-fp-row').first().click();

    const ask = page.locator('.wsm-3way');
    await expect(ask, 'the ONE prompt').toBeVisible();
    await expect(ask).toContainText(/replaces everything in this workspace/i);
    for (const w of ['save', 'discard', 'cancel']) await expect(ask.locator(`[data-w3="${w}"]`)).toBeVisible();
    await page.locator('#wsmOverlay .wsm-modal').screenshot({ path: testInfo.outputPath('wsm-unsaved-prompt.png') }).catch(() => {});
    await ask.screenshot({ path: testInfo.outputPath('wsm-prompt.png') });

    // CANCEL keeps everything exactly as it was, and nothing was downloaded behind the user's back
    await ask.locator('[data-w3="cancel"]').click();
    await expect(ask).toHaveCount(0);
    expect(downloaded, 'no silent safety download — the prompt IS the protection now').toBe(false);
    expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'the buffer is untouched after Cancel').toBe(true);
});

test('DISCARD opens the WHOLE file — every store, no picker', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('before.ddcs'); localStorage.setItem('ddcs_tpl_zzz_wsm3', JSON.stringify([{ n: 3 }])); });
    await grantFolder(page, FILES);
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('#wsmPickFolder').click();
    await page.locator('#wsmCards .wsm-fp-row').first().click();
    await page.locator('.wsm-3way [data-w3="discard"]').click();

    // wait for the LAST step of the open (the file-name stamp), not the machine row: the machine store is written
    // early in the restore loop, so waiting on it can read the workspace mid-open (t1225 — the loop now clears the
    // IDB project volume too, which put a real await between the two).
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsFileSavedName() === 'bench-router.ddcs', null, { timeout: 8000 });
    const after = await page.evaluate(() => ({
        machine: window.ddcsGetMachine(),
        envX: window.ddcsGetSettings().machine.x,
        savedName: window.ddcsFileSavedName(),
    }));
    // t2145 — no machine-record `.name` left to probe (BACKLOG F2); `savedName` below is the one-name-rule proof now.
    expect(after.machine.controllerId, 'including its controller').toBe('ddcs-v41');
    expect(after.envX, 'and its envelope — the whole file, not a chosen subset').toBe(300);
    expect(after.savedName, 'one-name rule: the file it came from is its name').toBe('bench-router.ddcs');
    // t1233 — a CROSS-CONTROLLER open (expert → V4.1) re-seeds the variable DB asynchronously; the baseline is taken
    // again once that lands, or a workspace reads "Unsaved changes" the instant it is opened.
    expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'a just-opened workspace is CLEAN, controller change and all').toBe(false);
});

test('Settings shows the IDENTITY BAND in the Workspace tab (display only)', async ({ page }, testInfo) => {
    await boot(page);
    // t2145 — the identity band's name reads fileSavedStem() now (BACKLOG F2), not a machine-record field.
    // t2192 — the band moved OUT of the always-visible header and INTO the Workspace tab (workspace CONTENT
    // belongs beside the rest of the workspace's own inventory) — land there, not Controller ▸ Profile.
    await page.evaluate(() => { window.ddcsSetMachine({ controllerId: 'ddcs-expert-m350' }, true); window.ddcsMarkWorkspaceSaved('m350-shop.ddcs'); });
    await page.evaluate(() => window.openSettings({ group: 'workspace', panel: 'set_tab_workspace' }));
    const band = page.locator('#set_identity_band');
    await expect(band).toBeVisible();
    await expect(band).toContainText('m350-shop');
    await expect(band, 'the controller at a glance').toContainText(/Expert M350/);
    await expect(band, 'and the envelope').toContainText(/Envelope/);
    await expect(band.locator('input'), 'display only — nothing to edit here').toHaveCount(0);
    await page.locator('#settings-app .settings-identity').screenshot({ path: testInfo.outputPath('settings-identity-band.png') });
});
