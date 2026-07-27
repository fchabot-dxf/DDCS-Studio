import { test, expect } from '@playwright/test';

/**
 * t1231 — THE MANAGER TELLS THE TRUTH (user live findings).
 *
 *  1. STATE. The user screenshotted "Untitled workspace · Saved · nothing has changed" — a state the one-name rule
 *     forbids (a save IS a file with a name). It came from a NAMELESS mark: something stamped "saved" and deleted the
 *     name, and the manager then read the bare timestamp as proof of a file. Saved now requires a NAME, at both ends:
 *     data/backup.js refuses to record a nameless save at all, and the manager reads the name rather than the clock —
 *     which is what makes a browser that already carries a nameless mark tell the truth again.
 *  2. DELETE. Each row can delete its file. The confirm names it and says PLAINLY that it is permanent and does not
 *     go to the Recycle Bin; it fails closed; the active workspace can be deleted and keeps working.
 *  3. THE ENVELOPE AS DECLARED — signs included. The sign is the home-direction declaration, so stripping it (both
 *     summaries used Math.abs) described a different machine.
 *  4. BROWSE… is gone and stays gone.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const ddcs = (name, { x, y, z }, controllerId) => ({
    name: name + '.ddcs',
    body: JSON.stringify({
        kind: 'ddcs.backup', v: 1, app: 'test', date: '2026-07-24T10:00:00.000Z',
        stores: { machine: { name, controllerId }, settings: { machine: { x, y, z, show: true } } },
    }),
});

const FILES = [
    ddcs('m350-shop', { x: 850, y: -850, z: -120 }, 'ddcs-expert-m350'),
    ddcs('bench-router', { x: 300, y: 200, z: -80 }, 'ddcs-v41'),
];

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager && window.ddcsFileSaveState && window.ddcsWorkspaceDirtyToFile);
    await page.evaluate(() => { window.__ddcsNoReload = true; });
}

/** A fake granted folder whose files can be READ and REMOVED, so delete is driven for real. */
async function grantFolder(page, files) {
    await page.evaluate((fs) => {
        const map = window.__fs = new Map(fs.map((f) => [f.name, f.body]));
        window.showDirectoryPicker = async () => ({
            kind: 'directory', name: 'Workspaces',
            queryPermission: async () => 'granted',
            async *entries() {
                for (const [n, body] of [...map]) {
                    yield [n, { kind: 'file', name: n, getFile: async () => new File([body], n), queryPermission: async () => 'granted' }];
                }
            },
            removeEntry: async (n) => { if (!map.delete(n)) throw new Error('not found'); window.__removed = (window.__removed || []).concat(n); },
        });
    }, files);
}

const openFolder = async (page, focus = 'open') => {
    await page.evaluate((f) => window.openWorkspaceManager(f), focus);
    await page.locator('#wsmPickFolder').click();
    await expect(page.locator('#wsmCards .wsm-fp-row').first()).toBeVisible();
};

test('STATE: a nameless "saved" mark can no longer be recorded — and an old one reads as NEVER SAVED', async ({ page }, testInfo) => {
    await boot(page);
    // the corrupt pair a pre-t1231 build could leave behind: a save time with no file name
    await page.evaluate(() => {
        localStorage.setItem('ddcs_file_saved_at', String(Date.now()));
        localStorage.removeItem('ddcs_file_saved_name');
        localStorage.setItem('ddcs_file_watermark', String(window.ddcsFileSaveState.signature()));
    });
    await page.evaluate(() => window.openWorkspaceManager('save'));
    const cur = page.locator('#wsmCurrent');
    await expect(cur.locator('.wsm-cur-name')).toHaveText('Untitled workspace');
    await expect(cur.locator('.wsm-state'), 'an unnamed workspace is NEVER saved — the clock is not proof of a file').toHaveText('Never saved to a file');
    await expect(cur, 'and it does not claim nothing has changed since a save that has no file').not.toContainText('Nothing has changed');
    await expect(cur.locator('.wsm-cur-when'), 'nor show a save TIME for a save that left no file — the same lie, smaller').toHaveCount(0);
    await expect(cur.locator('[data-wsm="duplicate"]'), 'nothing to duplicate before there is a file').toHaveCount(0);
    await page.locator('#wsmOverlay .wsm-modal').screenshot({ path: testInfo.outputPath('never-saved-honest.png') });

    // and the source is closed: a nameless mark records NOTHING rather than half a fact
    const after = await page.evaluate(() => {
        localStorage.removeItem('ddcs_file_saved_at');
        window.ddcsMarkWorkspaceSaved('');            // the shape that produced the impossible state
        return { at: localStorage.getItem('ddcs_file_saved_at'), name: localStorage.getItem('ddcs_file_saved_name') };
    });
    expect(after.at, 'a nameless save is not recorded as a save').toBeNull();
    expect(after.name).toBeNull();
});

test('STATE: with a real file name it reads Saved, and Duplicate appears', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.ddcsMarkWorkspaceSaved('m350-shop.ddcs'));
    await page.evaluate(() => window.openWorkspaceManager('save'));
    const cur = page.locator('#wsmCurrent');
    await expect(cur.locator('.wsm-cur-name')).toHaveText('m350-shop.ddcs');
    await expect(cur.locator('.wsm-state')).toHaveText('Saved');
    await expect(cur.locator('[data-wsm="duplicate"]')).toBeVisible();
});

test('THE ENVELOPE IS SHOWN AS DECLARED — signs included (the sign IS the home-direction declaration)', async ({ page }, testInfo) => {
    await boot(page);
    await grantFolder(page, FILES);
    await openFolder(page);
    const row = page.locator('#wsmCards .wsm-fp-row', { hasText: 'm350-shop' });
    await expect(row.locator('.wsm-c-env'), 'not X 850 Y 850 Z 120 — that is a different machine (t1243: with the axis LETTERS)').toHaveText('X 850 Y -850 Z -120');
    await page.locator('#wsmCards').screenshot({ path: testInfo.outputPath('signed-envelope-rows.png') });

    // the Settings band reads the SAME formatter, so the two surfaces cannot describe one machine differently
    await page.evaluate(() => { const s = window.ddcsGetSettings(); Object.assign(s.machine, { x: 850, y: -850, z: -120 }); });
    await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_profile' }));
    await expect(page.locator('#set_identity_band')).toContainText('X 850 Y -850 Z -120');
});

test('DELETE: the confirm names the file, says PERMANENT + no Recycle Bin, and Cancel touches nothing', async ({ page }, testInfo) => {
    await boot(page);
    await grantFolder(page, FILES);
    await openFolder(page);
    await expect(page.locator('#wsmCards .wsm-fp-row')).toHaveCount(2);

    await page.locator('#wsmCards .wsm-fp-row', { hasText: 'bench-router' }).locator('[data-wsm-del]').click();
    const dlg = page.locator('.app-dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg, 'it names the file').toContainText('bench-router.ddcs');
    await expect(dlg, 'and says plainly what deleting means here').toContainText(/PERMANENTLY/);
    await expect(dlg).toContainText(/does not go to the Recycle Bin/i);
    await expect(dlg.locator('button')).toHaveCount(2);
    await page.locator('.app-dialog > div').screenshot({ path: testInfo.outputPath('delete-confirm.png') });

    await dlg.locator('button', { hasText: 'Cancel' }).click();
    expect(await page.evaluate(() => [...window.__fs.keys()]), 'Cancel deleted nothing').toHaveLength(2);
    await expect(page.locator('#wsmCards .wsm-fp-row')).toHaveCount(2);
});

test('DELETE: confirming removes the file AND its row', async ({ page }) => {
    await boot(page);
    await grantFolder(page, FILES);
    await openFolder(page);
    await page.locator('#wsmCards .wsm-fp-row', { hasText: 'bench-router' }).locator('[data-wsm-del]').click();
    await page.locator('.app-dialog button', { hasText: 'Delete' }).click();

    await expect(page.locator('#wsmCards .wsm-fp-row')).toHaveCount(1);
    await expect(page.locator('#wsmCards .wsm-fp-row').first()).toContainText('m350-shop');
    expect(await page.evaluate(() => [...window.__fs.keys()]), 'the file itself is gone from the folder').toEqual(['m350-shop.ddcs']);
    expect(await page.evaluate(() => window.__removed), 'through the real removeEntry').toEqual(['bench-router.ddcs']);
});

test('DELETE: the OPEN workspace can be deleted — the buffer keeps working and the state flips to never-saved', async ({ page }) => {
    await boot(page);
    await grantFolder(page, FILES);
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('m350-shop.ddcs'); localStorage.setItem('ddcs_tpl_keepme_1231', JSON.stringify([{ n: 1 }])); });
    await openFolder(page, 'save');

    await page.locator('#wsmCards .wsm-fp-row', { hasText: 'm350-shop' }).locator('[data-wsm-del]').click();
    const dlg = page.locator('.app-dialog');
    await expect(dlg, 'the confirm SAYS it is the one you have open').toContainText(/workspace you have open/i);
    await dlg.locator('button', { hasText: 'Delete' }).click();

    await expect(page.locator('#wsmCurrent .wsm-state')).toHaveText('Never saved to a file');
    const r = await page.evaluate(() => ({
        name: window.ddcsFileSavedName(),
        dirty: window.ddcsWorkspaceDirtyToFile(),
        preset: localStorage.getItem('ddcs_tpl_keepme_1231'),
        handle: window.ddcsSaveHandleName(),
    }));
    expect(r.name, 'it has no file any more').toBeNull();
    expect(r.dirty, 'and its work lives in no file — that is unsaved, not clean').toBe(true);
    expect(r.preset, 'the buffer itself is untouched — deleting a file is not deleting your work').toBeTruthy();
    expect(r.handle, 'and Ctrl+S will ask where to put it rather than writing to a deleted file').toBeNull();
});

/**
 * t1231 AMENDMENT (user: "a backup copy still appears when loading a workspace").
 *
 * The rule: an OPEN performs exactly ZERO writes beyond the user's own explicit save in the save-first prompt. These
 * three tests pin every branch of the open flow — discard, cancel, and save-and-continue — against BOTH kinds of write
 * a workspace can produce: a new file in the granted folder, and a download.
 */
test('OPENING WRITES NOTHING: discarding an unsaved buffer creates no file and downloads nothing', async ({ page }) => {
    await boot(page);
    await grantFolder(page, FILES);
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('m350-shop.ddcs'); localStorage.setItem('ddcs_tpl_dirty_1231', JSON.stringify([{ n: 1 }])); });
    expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'there IS unsaved work, so the prompt fires').toBe(true);

    let downloads = 0;
    page.on('download', () => { downloads++; });
    await openFolder(page, 'open');
    await page.locator('#wsmCards .wsm-fp-row', { hasText: 'bench-router' }).click();
    await page.locator('.wsm-3way [data-w3="discard"]').click();
    await page.waitForFunction(() => window.ddcsFileSavedName() === 'bench-router.ddcs', null, { timeout: 8000 });

    expect(await page.evaluate(() => [...window.__fs.keys()]), 'no new file in the folder — an open is a READ')
        .toEqual(['m350-shop.ddcs', 'bench-router.ddcs']);
    expect(downloads, 'and no backup copy in Downloads').toBe(0);
});

test('OPENING WRITES NOTHING: cancelling the prompt writes nothing either', async ({ page }) => {
    await boot(page);
    await grantFolder(page, FILES);
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('m350-shop.ddcs'); localStorage.setItem('ddcs_tpl_dirty2_1231', JSON.stringify([{ n: 2 }])); });
    let downloads = 0;
    page.on('download', () => { downloads++; });
    await openFolder(page, 'open');
    await page.locator('#wsmCards .wsm-fp-row', { hasText: 'bench-router' }).click();
    await page.locator('.wsm-3way [data-w3="cancel"]').click();
    expect(await page.evaluate(() => [...window.__fs.keys()])).toHaveLength(2);
    expect(downloads).toBe(0);
    expect(await page.evaluate(() => window.ddcsFileSavedName()), 'and the workspace is the one we started in').toBe('m350-shop.ddcs');
});

test('SAVE AND CONTINUE writes exactly ONE file — the user\'s own, no second copy beside it', async ({ page }) => {
    await boot(page);
    await grantFolder(page, FILES);
    // the buffer belongs to m350-shop and has unsaved work; the save handle points at that file
    await page.evaluate(() => {
        const files = window.__fs;
        window.showSaveFilePicker = undefined;
        window.ddcsMarkWorkspaceSaved('m350-shop.ddcs');
        localStorage.setItem('ddcs_tpl_dirty3_1231', JSON.stringify([{ n: 3 }]));
        window.__writes = [];
        window.ddcsAdoptSaveHandle({
            name: 'm350-shop.ddcs', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
            createWritable: async () => ({ write: async (t) => { window.__writes.push('m350-shop.ddcs'); files.set('m350-shop.ddcs', t); }, close: async () => {} }),
        });
    });
    let downloads = 0;
    page.on('download', () => { downloads++; });

    await openFolder(page, 'open');
    await page.locator('#wsmCards .wsm-fp-row', { hasText: 'bench-router' }).click();
    await page.locator('.wsm-3way [data-w3="save"]').click();
    await page.waitForFunction(() => window.ddcsFileSavedName() === 'bench-router.ddcs', null, { timeout: 8000 });

    expect(await page.evaluate(() => window.__writes), 'ONE write, to the file the user was already in').toEqual(['m350-shop.ddcs']);
    expect(await page.evaluate(() => [...window.__fs.keys()]), 'no third file appeared').toEqual(['m350-shop.ddcs', 'bench-router.ddcs']);
    expect(downloads, 'and nothing was downloaded on the side').toBe(0);
});

test('the quick-menu identity line carries the SIGNED envelope, from the same one source', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        window.ddcsSetMachine({ name: 'm350-shop', controllerId: 'ddcs-expert-m350' }, true);
        const s = window.ddcsGetSettings(); Object.assign(s.machine, { x: 850, y: -850, z: -120 });
        window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));
    });
    await page.locator('#hdrPostBtn').click();
    const line = page.locator('#hdrPostMenu .hq-identity-line');
    await expect(line).toContainText('m350-shop');
    await expect(line).toContainText(/Expert M350/);
    await expect(line, 'the envelope as declared — signs AND axis letters (t1243), from the one formatter').toContainText('X 850 Y -850 Z -120');
    expect(await page.evaluate(() => document.querySelector('#hdrPostMenu .hq-identity-line').tagName), 'still plain text, still not a button').not.toBe('BUTTON');
});

test('BROWSE… is gone — no button, and no message pointing at one', async ({ page }) => {
    await boot(page);
    await grantFolder(page, FILES);
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await expect(page.locator('#wsmBrowse')).toHaveCount(0);
    // the hazard is the retired BUTTON, not the letters: "browser" is a legitimate word (the over-broad proxy caught
    // the honest no-folder message on its first run)
    const BROWSE_DOOR = /Browse\s*(…|\.\.\.)/;
    const txt = await page.locator('#wsmOverlay').innerText();
    expect(txt, 'no Browse… affordance anywhere on the surface').not.toMatch(BROWSE_DOOR);
    // the no-folder-support path used to send people to that retired button
    await page.evaluate(() => { window.showDirectoryPicker = undefined; });
    await page.locator('#wsmPickFolder').click();
    const dlg = page.locator('.app-dialog');
    await expect(dlg).toBeVisible();
    expect(await dlg.innerText(), 'it says what this browser CAN do instead of naming a door that no longer exists').not.toMatch(BROWSE_DOOR);
});
