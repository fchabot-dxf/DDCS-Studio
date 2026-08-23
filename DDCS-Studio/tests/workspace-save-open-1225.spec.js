import { test, expect } from '@playwright/test';

/**
 * t1225 — SAVING AND OPENING, against a fake File System Access layer.
 *
 * The whole point of these tests is the pair of things a green t1223 suite could not see, because nothing there ever
 * WROTE a file after opening one:
 *
 *   1. OPEN MUST RETARGET THE SAVE HANDLE. Opening B while the remembered handle still points at A meant the next
 *      Ctrl+S silently overwrote A with B's contents — the worst kind of data loss, since nothing on screen is wrong.
 *   2. (RETIRED t2145, BACKLOG F2 — "there is no name field any more, only the file's own") THE NAME WAS STAMPED
 *      BEFORE THE BYTES WERE BUILT, into a machine-record `name` field kept in sync with the filename. That field
 *      is gone: `fileSavedName()` (data/backup.js) is the ONE source now, and it can never lag behind — there is
 *      no second copy left to stamp out of order. What these tests still guard: a save actually clean the instant
 *      it lands, and the saved file itself carrying the name it was saved AS.
 *
 * The FSA layer is faked with real bytes in a Map, so the code under test is the real save/open path — the only thing
 * replaced is the OS dialog. `showSaveFilePicker` is deliberately absent: the ruled first-save flow is name + FOLDER.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const wsFile = (name, controllerId = 'ddcs-expert-m350', extra = {}) => JSON.stringify({
    kind: 'ddcs.backup', v: 1, app: 'test', date: '2026-07-20T10:00:00.000Z',
    stores: {
        machine: { name, controllerId },
        settings: { machine: { x: 500, y: 400, z: -100, show: true } },
        ...extra,
    },
});

/** A fake granted folder over an in-memory Map of REAL .ddcs bytes; every handle behaves like the FSA shape. */
async function fakeFs(page, seed) {
    await page.evaluate((entries) => {
        const files = new Map(entries);
        const fs = window.__fs = { files, dirPicks: 0, seeded: new Map(entries) };
        const fileHandle = (name) => ({
            kind: 'file', name,
            getFile: async () => new File([files.get(name) || ''], name),
            queryPermission: async () => 'granted',
            requestPermission: async () => 'granted',
            createWritable: async () => ({ write: async (t) => { files.set(name, t); }, close: async () => {} }),
        });
        const dir = {
            kind: 'directory', name: 'Workspaces',
            queryPermission: async () => 'granted',
            requestPermission: async () => 'granted',
            async *entries() { for (const n of [...files.keys()]) yield [n, fileHandle(n)]; },
            async getFileHandle(n, opts) {
                if (!files.has(n)) {
                    if (!opts || !opts.create) { const e = new Error('not found'); e.name = 'NotFoundError'; throw e; }
                    files.set(n, '');
                }
                return fileHandle(n);
            },
        };
        fs.dir = dir;
        window.showDirectoryPicker = async () => { fs.dirPicks++; return dir; };
        window.showSaveFilePicker = undefined;   // the ruled flow is name + folder, not an OS save dialog
    }, [...Object.entries(seed)]);
}

async function boot(page, seed) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager && window.ddcsSaveWorkspace && window.ddcsSaveHandleName);
    await page.evaluate(() => { window.__ddcsNoReload = true; });   // the open path reloads in the app; keep the test page
    await fakeFs(page, seed);
}

/** Open the manager on the folder half and click the row for `name`. */
async function openFromFolder(page, name) {
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('#wsmPickFolder').click();
    await page.locator(`#wsmCards .wsm-fp-row:has-text("${name}")`).first().click();
    // wait for the LAST effect of an open, not the first: arming the save handle is the final step (t1233 put the
    // controller-settle wait in front of it), so anything that reads state before this is reading mid-open.
    await page.waitForFunction((n) => window.ddcsSaveHandleName() === n + '.ddcs', name, { timeout: 8000 }).catch(() => {});
}

const readFs = (page) => page.evaluate(() => Object.fromEntries(window.__fs.files));

test('BLOCKER — opening B RETARGETS the save handle: the next Save writes B and leaves A untouched', async ({ page }) => {
    await boot(page, { 'alpha.ddcs': wsFile('alpha'), 'beta.ddcs': wsFile('beta', 'ddcs-v41') });

    await openFromFolder(page, 'alpha');
    await page.waitForFunction(() => window.ddcsFileSavedName() === 'alpha.ddcs');
    expect(await page.evaluate(() => window.ddcsSaveHandleName()), 'opening A arms Save on A').toBe('alpha.ddcs');

    await openFromFolder(page, 'beta');
    await page.waitForFunction(() => window.ddcsFileSavedName() === 'beta.ddcs');
    expect(await page.evaluate(() => window.ddcsSaveHandleName()), 'opening B re-arms Save on B').toBe('beta.ddcs');

    // the plain Save — no dialog, writes in place
    const res = await page.evaluate(() => window.ddcsSaveWorkspace());
    expect(res.ok).toBe(true);
    expect(res.name).toBe('beta.ddcs');

    const files = await readFs(page);
    const seeded = await page.evaluate(() => Object.fromEntries(window.__fs.seeded));
    expect(files['alpha.ddcs'], 'A is byte-for-byte what it was — the save did NOT reach back into it').toBe(seeded['alpha.ddcs']);
    expect(files['beta.ddcs'], 'B was actually rewritten').not.toBe(seeded['beta.ddcs']);
});

test('BLOCKER — Save As writes the new file under its OWN name and leaves the workspace CLEAN the moment it is saved', async ({ page }) => {
    await boot(page, { 'alpha.ddcs': wsFile('alpha') });
    await openFromFolder(page, 'alpha');
    await page.waitForFunction(() => window.ddcsFileSavedName() === 'alpha.ddcs');

    // Save As under a NEW name → the guided flow (name + the already-granted folder)
    const saving = page.evaluate(() => window.ddcsSaveWorkspace({ pickNew: true }));
    await page.waitForSelector('#wssAsk', { timeout: 8000 });
    await page.fill('#wssName', 'gamma');
    await page.locator('#wssAsk [data-wss="save"]').click();
    expect((await saving).name).toBe('gamma.ddcs');

    const files = await readFs(page);
    expect(Object.keys(files), 'the new file exists beside the old one').toContain('gamma.ddcs');
    expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'and saving leaves the workspace CLEAN (the stamp is inside the baseline)').toBe(false);
    // t2145 — the workspace's name IS its last-saved file's name (BACKLOG F2); no separate machine-record field
    // to lag behind any more, so this is the whole "the live workspace took the new name too" check now.
    expect(await page.evaluate(() => window.ddcsFileSavedName()), 'the live workspace took the new name too').toBe('gamma.ddcs');
});

test('the FIRST save is ONE step: name + folder grant together, written INTO the folder, never an autogenerated name', async ({ page }) => {
    await boot(page, {});   // an empty folder and no remembered file — a brand-new user
    let downloaded = false;
    page.on('download', () => { downloaded = true; });

    const saving = page.evaluate(() => window.ddcsSaveWorkspace());
    await page.waitForSelector('#wssAsk', { timeout: 8000 });
    // ONE dialog asks the name, and its primary button says what the click will do about the folder
    await expect(page.locator('#wssAsk [data-wss="save"]')).toHaveText(/Choose folder and save/i);
    await page.fill('#wssName', 'lathe-1');
    await page.locator('#wssAsk [data-wss="save"]').click();

    const res = await saving;
    expect(res.ok, 'the save went through').toBe(true);
    expect(res.viaFsa, 'through a real file handle, not a download').toBe(true);
    expect(await page.evaluate(() => window.__fs.dirPicks), 'the folder was granted in that same click').toBe(1);

    const files = await readFs(page);
    expect(Object.keys(files), 'the file landed IN the workspaces folder, named what the user typed').toEqual(['lathe-1.ddcs']);
    expect(Object.keys(files)[0], 'no backup-style autogenerated filename').not.toMatch(/^ddcs-workspace-/);
    expect(downloaded, 'and nothing was downloaded').toBe(false);
    expect(await page.evaluate(() => window.ddcsFileSavedName())).toBe('lathe-1.ddcs');

    // …and the manager lists what was just saved — the point of saving into the granted folder
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('#wsmPickFolder').click();
    await expect(page.locator('#wsmCards .wsm-fp-row')).toHaveCount(1);
    await expect(page.locator('#wsmCards .wsm-fp-row .wsm-c-name')).toContainText('lathe-1');
});

/**
 * THE USER FLOW, END TO END (t1225 amendment — live symptom: opening their OWN workspace said "not a valid .ddcs
 * file"). Nothing above proves this: those files are hand-written JSON. This one saves through the real Save door,
 * then opens THAT file through the real Open door, so the bytes under test are the ones the app actually writes.
 */
test('ROUND TRIP — a workspace this app just saved opens again through the same doors', async ({ page }) => {
    await boot(page, {});
    await page.evaluate(() => localStorage.setItem('ddcs_tpl_roundtrip_1225', JSON.stringify([{ name: 'before saving' }])));

    // SAVE through the real door
    const saving = page.evaluate(() => window.ddcsSaveWorkspace());
    await page.waitForSelector('#wssAsk', { timeout: 8000 });
    await page.fill('#wssName', 'my-shop');
    await page.locator('#wssAsk [data-wss="save"]').click();
    expect((await saving).ok).toBe(true);

    // change something, so opening has real work to replace…
    await page.evaluate(() => localStorage.setItem('ddcs_tpl_roundtrip_1225', JSON.stringify([{ name: 'after saving' }])));
    expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile())).toBe(true);

    // …then OPEN it back through the real door: the folder panel lists it as a readable workspace, not "cannot be opened"
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('#wsmPickFolder').click();
    const row = page.locator('#wsmCards .wsm-fp-row');
    await expect(row).toHaveCount(1);
    await expect(row, 'the app can read its own file').not.toHaveClass(/is-bad/);
    await row.click();
    await page.locator('.wsm-3way [data-w3="discard"]').click();

    // no refusal, and the saved state came back
    await expect(page.locator('.app-dialog'), 'no "not a valid workspace" notice on the app\'s OWN file').toHaveCount(0);
    await page.waitForFunction(() => !window.ddcsWorkspaceDirtyToFile(), null, { timeout: 8000 });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_tpl_roundtrip_1225'))[0].name),
        'the SAVED state is what came back').toBe('before saving');
    expect(await page.evaluate(() => window.ddcsFileSavedName())).toBe('my-shop.ddcs');
});

test('a refusal SAYS WHICH CHECK FAILED — and a byte-order mark is not a reason to refuse', async ({ page }) => {
    const good = wsFile('bommed');
    await boot(page, {
        'has-bom.ddcs': '﻿' + good,            // been through an external editor; still this app's own bytes
        'not-json.ddcs': 'this is not json at all',
        'other-kind.ddcs': JSON.stringify({ kind: 'ddcs.macro', v: 1, stack: [] }),
        'empty.ddcs': '',
        'a-bundle.ddcs': JSON.stringify({ name: 'Rig B', controllerId: 'ddcs-v41', settings: {}, userVars: [] }),
    });
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('#wsmPickFolder').click();
    await expect(page.locator('#wsmCards .wsm-fp-row')).toHaveCount(5);

    // t1231 — the row is a wrapper now (open button + delete button); the reason tooltip lives on the OPEN button
    const reason = async (name) => page.locator(`#wsmCards .wsm-fp-row:has-text("${name}") .wsm-fp-open`).first().getAttribute('title');
    expect(await reason('not-json'), 'says it is not JSON, and shows the parser\'s own words').toMatch(/not valid JSON/i);
    expect(await reason('other-kind'), 'names the kind it actually found').toMatch(/ddcs\.macro.*not a DDCS workspace/i);
    expect(await reason('empty'), 'says the file is empty').toMatch(/empty/i);
    expect(await reason('a-bundle'), 'names the shape it recognises instead of a flat "not valid"').toMatch(/machine-configuration bundle/i);

    // the BOM'd file is a normal, openable row — tolerated, not refused
    const bom = page.locator('#wsmCards .wsm-fp-row:has-text("has-bom")').first();
    await expect(bom).not.toHaveClass(/is-bad/);
    await bom.click();
    await page.waitForFunction(() => window.ddcsFileSavedName() === 'has-bom.ddcs', null, { timeout: 8000 });
    await expect(page.locator('.app-dialog'), 'no refusal for an invisible byte-order mark').toHaveCount(0);
});

test('ONE NAME — an OS-renamed file shows its OWN name everywhere after opening', async ({ page }) => {
    // t2145 — the fixture's INNER `stores.machine.name` is fixture noise now (BACKLOG F2 deleted the field the
    // app itself reads/writes; restoreBackup simply ignores an unrecognised leftover key). What makes this test
    // still worth having: there is no longer a SECOND name that COULD go stale — fileSavedName() is stamped from
    // the file's own on-disk name at open time (markWorkspaceSavedToFile), independent of anything inside the
    // bytes, so an OS rename can never leave two surfaces disagreeing about what this workspace is called.
    await boot(page, { 'renamed-on-disk.ddcs': wsFile('what-it-used-to-be-called') });
    await openFromFolder(page, 'renamed-on-disk');

    expect(await page.evaluate(() => window.ddcsFileSavedName()), 'the workspace name IS the file name — the one it was actually opened as').toBe('renamed-on-disk.ddcs');
    expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'and the rename does not make the workspace dirty').toBe(false);
});

test('a whole-file open RESETS what the file does not carry (the file IS the workspace)', async ({ page }) => {
    await boot(page, { 'alpha.ddcs': wsFile('alpha') });   // carries machine + settings, nothing else
    await page.evaluate(() => localStorage.setItem('ddcs_tpl_pocket_1225', JSON.stringify([{ name: 'buffer only' }])));

    await openFromFolder(page, 'alpha');
    await page.waitForFunction(() => window.ddcsFileSavedName() === 'alpha.ddcs');

    expect(await page.evaluate(() => localStorage.getItem('ddcs_tpl_pocket_1225')),
        'a preset the opened file never carried does not survive the open').toBeNull();
    expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'and the result is clean — it IS the file').toBe(false);
});

test('a machine-less (pre-pivot) .ddcs is REFUSED with one plain message, not silently restored', async ({ page }) => {
    const legacy = JSON.stringify({ kind: 'ddcs.backup', v: 1, app: 'old', date: '2025-01-01T00:00:00.000Z', stores: { settings: { machine: { x: 1, y: 2, z: -3 } } } });
    await boot(page, { 'old-format.ddcs': legacy });
    const before = await page.evaluate(() => window.ddcsGetMachine());

    await openFromFolder(page, 'old-format');
    // the panel already marks it unopenable, and clicking says WHY rather than ignoring the click
    await expect(page.locator('#wsmCards .wsm-fp-row').first()).toHaveClass(/is-bad/);
    const dlg = page.locator('.app-dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText(/older format and has no machine record/i);

    // nothing was applied: no migration, no wrong controller adopted, no envelope from the old file
    expect(await page.evaluate(() => window.ddcsGetMachine()), 'the workspace is untouched').toEqual(before);
    expect(await page.evaluate(() => window.ddcsGetSettings().machine.x), 'the refused envelope never landed').not.toBe(1);
});

/**
 * t2196 (amendment 2, bug 2) — THE FILE MENU'S OWN "Save" ROW WRITES IN PLACE, no modal. A live human report caught
 * ui/headerPost.js's `case 'wsSave'` opening the workspace manager instead of writing — a regression against this
 * row's own label ("Save", no ellipsis) and tooltip ("Save this workspace to its .ddcs file"), and against the same
 * silent-re-save contract Ctrl+S already honours (ui/workspaceSave.js's saveWorkspace(), wired to both). These two
 * tests drive the actual menu click (`#hdrPostBtn` → `[data-act="wsSave"]`), not the underlying function directly,
 * because the bug was in the WIRING between the row and the door, not in the door itself.
 */
test('THE FILE MENU\'S "Save" ROW writes an already-open workspace IN PLACE — no dialog, no manager', async ({ page }) => {
    await boot(page, { 'alpha.ddcs': wsFile('alpha') });
    await openFromFolder(page, 'alpha');
    await page.waitForFunction(() => window.ddcsFileSavedName() === 'alpha.ddcs');
    // a real open normally reloads the page, tearing the manager modal down with it; __ddcsNoReload keeps the
    // page (so this test can inspect state after), which also means the modal itself is still up — close it,
    // the same way a real reload would, before driving the file menu's own Save row.
    await page.locator('#wsmOverlay .wsm-x').click();
    await expect(page.locator('#wsmOverlay')).toHaveCount(0);

    // a real edit, so the save has something true to write
    await page.evaluate(() => { localStorage.setItem('ddcs_tpl_zzz_wssave', JSON.stringify([{ n: 1 }])); window.ddcsFileSaveState.refresh(); });
    expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile())).toBe(true);

    await page.click('#hdrPostBtn');
    await page.click('#hdrPostMenu [data-act="wsSave"]');

    // no dialog, no manager — the write is silent
    await expect(page.locator('#wssAsk'), 'no name/folder ask — a handle already exists').toHaveCount(0);
    await expect(page.locator('#wsmOverlay'), 'no manager modal').toHaveCount(0);
    await page.waitForFunction(() => window.ddcsWorkspaceDirtyToFile() === false, null, { timeout: 5000 });

    const files = await readFs(page);
    expect(files['alpha.ddcs'], 'the file was actually rewritten').toContain('zzz_wssave');
});

test('THE FILE MENU\'S "Save" ROW asks ONCE when there is nothing to write to yet (never saved)', async ({ page }) => {
    await boot(page, {});   // no remembered file — a brand-new user, same as the FIRST-save test above
    await page.click('#hdrPostBtn');
    await page.click('#hdrPostMenu [data-act="wsSave"]');

    await page.waitForSelector('#wssAsk', { timeout: 8000 });   // nothing to write to yet — asking once is correct, not a bug
    await page.fill('#wssName', 'first-save');
    await page.locator('#wssAsk [data-wss="save"]').click();

    await page.waitForFunction(() => window.ddcsFileSavedName() === 'first-save.ddcs', null, { timeout: 8000 });
    const files = await readFs(page);
    expect(Object.keys(files)).toContain('first-save.ddcs');
});
