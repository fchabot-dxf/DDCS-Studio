import { test, expect } from '@playwright/test';

/**
 * t1233 A3 — THE CLOUD TAB. Google Drive is ANOTHER PLACE WORKSPACES LIVE, not another kind of thing.
 *
 * The manager's file list grows [ Local folder ] [ Cloud ]. The cloud half lists the .ddcs files in the app's Drive
 * folder through the SAME row formatter (name · SIGNED envelope · dialect · saved-when), opens them through the SAME
 * whole-file open (with the same save-first prompt), and deletes through Drive's TRASH — which is recoverable, so its
 * confirm promises something different from the local one.
 *
 * Drive is faked at the network edge (the REST calls googleDrive.js makes), so the module under test is the real one:
 * the same ensureRoot / list / read / write / trash path the retired project-cloud doors used.
 */
test.use({ viewport: { width: 1280, height: 900 } });

// t1257 — the fake Drive's route handler calls page.evaluate, so a request still in flight when a test ends throws
// "Test ended" and fails the run at random. It flaked across several turns and was written off as load each time;
// Playwright names the fix in the error itself. Dropping the routes first makes the end of a test deterministic.
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); });

const ws = (name, { x, y, z }, controllerId) => ({
    kind: 'ddcs.backup', v: 1, app: 'test', date: '2026-07-24T10:00:00.000Z',
    stores: { machine: { name, controllerId }, settings: { machine: { x, y, z, show: true } } },
});

const CLOUD = {
    'file-a': { name: 'm350-shop.ddcs', body: ws('m350-shop', { x: 850, y: -850, z: -120 }, 'ddcs-expert-m350') },
    'file-b': { name: 'bench-router.ddcs', body: ws('bench-router', { x: 300, y: 200, z: -80 }, 'ddcs-v41') },
};

/** Fake the Drive REST surface: the folder lookup, the listing, per-file reads, the multipart upload and the trash. */
async function fakeDrive(page, files = CLOUD) {
    await page.evaluate((seed) => { window.__drive = { files: JSON.parse(JSON.stringify(seed)), writes: [], trashed: [] }; }, files);
    await page.route('https://www.googleapis.com/**', async (route) => {
        const url = route.request().url();
        const method = route.request().method();
        const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        const state = await page.evaluate(() => window.__drive);

        // ORDER + PRECISION matter here: the folder LISTING url also contains the words "mimeType" (in fields=) and
        // "folder" (in orderBy=folder,name), so a loose /mimeType.*folder/ swallowed it and handed back the ROOT as if
        // it were the only file — an empty list with no error. Match the queries exactly instead.
        const q = decodeURIComponent((url.split('q=')[1] || '').split('&')[0]);
        if (/in parents/.test(q)) {
            if (/name=/.test(q)) return json({ files: [] });          // the upload's overwrite check (name-scoped)
            return json({ files: Object.entries(state.files).map(([id, f]) => ({ id, name: f.name, mimeType: 'application/json', modifiedTime: f.body.date })) });
        }
        if (/google-apps\.folder/.test(q)) return json({ files: [{ id: 'root-folder' }] });   // ensureRoot: found
        if (/\/drive\/v3\/files\/root-folder\?fields=id,trashed/.test(url)) return json({ id: 'root-folder', trashed: false });
        const media = url.match(/\/drive\/v3\/files\/([^?]+)\?alt=media/);
        if (media) return json(state.files[media[1]] ? state.files[media[1]].body : {});
        if (/\/upload\/drive\/v3\/files/.test(url)) {
            await page.evaluate((b) => window.__drive.writes.push(b), route.request().postData() || '');
            return json({ id: 'new-file' });
        }
        const patch = url.match(/\/drive\/v3\/files\/([^?]+)\?fields=id/);
        if (patch && method === 'PATCH') {
            const body = route.request().postDataJSON() || {};
            if (body.trashed) await page.evaluate((id) => { window.__drive.trashed.push(id); delete window.__drive.files[id]; }, patch[1]);
            return json({ id: patch[1] });
        }
        if (/\/drive\/v3\/about/.test(url)) return json({ user: { displayName: 'Maker', emailAddress: 'maker@example.com' } });
        return json({});
    });
}

async function boot(page, { signedIn = true } = {}) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager && window.ddcsFileSavedPlace);
    await page.evaluate(() => { window.__ddcsNoReload = true; });
    await page.evaluate((yes) => {
        if (yes) { localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google'); localStorage.setItem('ddcs_cloud_email', 'maker@example.com'); }
        else ['ddcs_cloud_token', 'ddcs_cloud_provider', 'ddcs_cloud_email'].forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem('ddcs_gdrive_folder');
    }, signedIn);
}

const openCloudTab = async (page) => {
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('.wsm-place[data-place="cloud"]').click();
};

test('the list grows a TAB PAIR — Local folder | Cloud — and local is unchanged', async ({ page }, testInfo) => {
    await boot(page);
    await fakeDrive(page);
    // t1265 — WHICH tab opens first is now decided by CONTEXT (the file's shelf; signed-in when there is no file),
    // and has its own three-case test. This one is about the PAIR and the local half, so it asks for local explicitly
    // instead of asserting a default that moved.
    await page.evaluate(() => window.openWorkspaceManager('open', { place: 'local' }));
    const tabs = page.locator('.wsm-places .wsm-place');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveText(/Local folder/);
    await expect(tabs.nth(1)).toHaveText(/Cloud/);
    await expect(tabs.nth(0), 'and the tab asked for is the one showing').toHaveClass(/is-active/);
    await expect(page.locator('#wsmPickFolder'), 'and the local half still offers its folder pick').toBeVisible();
    await page.locator('#wsmOverlay .wsm-modal').screenshot({ path: testInfo.outputPath('tabs-local.png') });
});

test('the CLOUD tab lists Drive workspaces in the same table, with the SIGNED envelope', async ({ page }, testInfo) => {
    await boot(page);
    await fakeDrive(page);
    await openCloudTab(page);

    const rows = page.locator('#wsmCards .wsm-fp-row');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('#wsmCards .wsm-fp-head')).toContainText(/Envelope/i);
    const m350 = rows.filter({ hasText: 'm350-shop' });
    await expect(m350.locator('.wsm-c-env'), 'the same one formatter as the local rows — signs AND axis letters (t1243)').toHaveText('X 850 Y -850 Z -120');
    await expect(m350.locator('.wsm-c-ctrl')).toHaveText(/Expert M350/);
    await expect(page.locator('#wsmPickFolder'), 'the local folder pick is not part of the cloud shelf').toBeHidden();
    await page.locator('#wsmOverlay .wsm-modal').screenshot({ path: testInfo.outputPath('tabs-cloud.png') });
});

test('clicking a cloud row OPENS it — the whole file — and a later Save goes back to the cloud', async ({ page }, testInfo) => {
    await boot(page);
    await fakeDrive(page);
    await openCloudTab(page);
    await page.locator('#wsmCards .wsm-fp-row', { hasText: 'bench-router' }).click();

    await page.waitForFunction(() => window.ddcsFileSavedName() === 'bench-router.ddcs', null, { timeout: 8000 });
    const after = await page.evaluate(() => ({
        machine: window.ddcsGetMachine(), envX: window.ddcsGetSettings().machine.x,
        place: window.ddcsFileSavedPlace(), dirty: window.ddcsWorkspaceDirtyToFile(), handle: window.ddcsSaveHandleName(),
    }));
    expect(after.machine.name, 'the workspace IS the opened file').toBe('bench-router');
    expect(after.machine.controllerId, 'including its controller').toBe('ddcs-v41');
    expect(after.envX, 'and its envelope — the whole file').toBe(300);
    expect(after.place, 'and we remember it came from the cloud').toBe('cloud');
    expect(after.dirty, 'opening leaves it clean, exactly like a local open').toBe(false);
    expect(after.handle, 'no local file handle is armed for a cloud workspace').toBeNull();
    await page.screenshot({ path: testInfo.outputPath('cloud-open.png'), clip: { x: 0, y: 0, width: 1280, height: 200 } });

    // a plain Save now writes back to Drive with no dialog
    const r = await page.evaluate(() => window.ddcsSaveWorkspace());
    expect(r.ok).toBe(true);
    expect(r.place).toBe('cloud');
    const writes = await page.evaluate(() => window.__drive.writes);
    expect(writes.length, 'one upload').toBe(1);
    expect(writes[0], 'carrying the whole workspace').toContain('ddcs.backup');
});

test('SAVE AS on the Cloud tab uploads to Drive — the active tab is where a save goes', async ({ page }, testInfo) => {
    await boot(page);
    await fakeDrive(page);
    await openCloudTab(page);
    await expect(page.locator('#wsmCards .wsm-fp-row')).toHaveCount(2);

    let downloads = 0;
    page.on('download', () => { downloads++; });
    await page.locator('#wsmCurrent [data-wsm="saveas"]').click();
    // the ask has no folder half in the cloud — Drive's app folder is the one place
    await page.waitForSelector('#wssAsk', { timeout: 8000 });
    await expect(page.locator('#wssAsk')).toContainText(/Google Drive/i);
    await expect(page.locator('#wssAsk [data-wss="save"]'), 'no folder to choose — just save').toHaveText(/Save/);
    await page.fill('#wssName', 'lathe-1');
    await page.locator('#wssAsk .wss-box [data-wss="save"]').screenshot({ path: testInfo.outputPath('cloud-save-ask.png') }).catch(() => {});
    await page.locator('#wssAsk [data-wss="save"]').click();

    await expect.poll(() => page.evaluate(() => window.__drive.writes.length), { timeout: 8000 }).toBe(1);
    const r = await page.evaluate(() => ({ name: window.ddcsFileSavedName(), place: window.ddcsFileSavedPlace(), body: window.__drive.writes[0] }));
    expect(r.name, 'named what the user typed').toBe('lathe-1.ddcs');
    expect(r.place, 'and it lives in the cloud now').toBe('cloud');
    expect(r.body, 'the whole workspace went up, not a fragment').toContain('ddcs.backup');
    expect(r.body, 'carrying the name it was saved as').toContain('lathe-1');
    expect(downloads, 'nothing was downloaded on the side').toBe(0);
});

test('OPENING FROM THE CLOUD WRITES NOTHING — no upload, no download, no local file', async ({ page }) => {
    await boot(page);
    await fakeDrive(page);
    let downloads = 0;
    page.on('download', () => { downloads++; });
    await openCloudTab(page);
    await page.locator('#wsmCards .wsm-fp-row', { hasText: 'm350-shop' }).click();
    await page.waitForFunction(() => window.ddcsFileSavedName() === 'm350-shop.ddcs', null, { timeout: 8000 });

    expect(await page.evaluate(() => window.__drive.writes), 'an open is a READ, in the cloud too').toEqual([]);
    expect(await page.evaluate(() => window.__drive.trashed)).toEqual([]);
    expect(downloads, 'and no backup copy on the side').toBe(0);
});

test('DELETE in the cloud says TRASHED (recoverable) — distinct from the local permanent wording', async ({ page }, testInfo) => {
    await boot(page);
    await fakeDrive(page);
    await openCloudTab(page);
    await page.locator('#wsmCards .wsm-fp-row', { hasText: 'bench-router' }).locator('[data-wsm-del]').click();

    const dlg = page.locator('.app-dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText('bench-router.ddcs');
    await expect(dlg, 'Drive trash is recoverable, and the wording says so').toContainText(/trash/i);
    await expect(dlg).toContainText(/30 days|restore it/i);
    await expect(dlg, 'and it does NOT borrow the local permanent wording').not.toContainText(/PERMANENTLY/);
    await page.locator('.app-dialog > div').screenshot({ path: testInfo.outputPath('cloud-delete-confirm.png') });

    await dlg.locator('button', { hasText: 'Move to trash' }).click();
    await expect(page.locator('#wsmCards .wsm-fp-row')).toHaveCount(1);
    expect(await page.evaluate(() => window.__drive.trashed), 'through Drive trash, not files.delete').toEqual(['file-b']);
});

test('SIGNED OUT: the cloud tab shows ONE sign-in button and never crashes', async ({ page }, testInfo) => {
    await boot(page, { signedIn: false });
    await openCloudTab(page);
    const cards = page.locator('#wsmCards');
    await expect(cards.locator('#wsmCloudSignIn')).toBeVisible();
    await expect(cards.locator('button')).toHaveCount(1);
    await expect(cards).toContainText(/your own Google Drive/i);
    await expect(page.locator('#wsmCards .wsm-fp-row'), 'nothing is listed while signed out').toHaveCount(0);
    await page.locator('#wsmOverlay .wsm-modal').screenshot({ path: testInfo.outputPath('cloud-signed-out.png') });

    // and switching back is always available — the local shelf never depends on the cloud
    await page.locator('.wsm-place[data-place="local"]').click();
    await expect(page.locator('#wsmPickFolder')).toBeVisible();
});

test('a Drive that will not answer states WHY and leaves the local shelf alone', async ({ page }) => {
    await boot(page);
    await page.route('https://www.googleapis.com/**', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
    await openCloudTab(page);
    await expect(page.locator('#wsmCards')).toContainText(/sign-in has expired|could not be reached/i);
    await expect(page.locator('#wsmCards'), 'and it points at the shelf that still works').toContainText(/Local folder/);
    await page.locator('.wsm-place[data-place="local"]').click();
    await expect(page.locator('#wsmPickFolder')).toBeVisible();
});

test('a SLOW render that lost the race paints nothing — the tab you are on is the tab you see (t1243)', async ({ page }) => {
    // THE RACE, staged: switch to Cloud (whose Drive listing is held up), then switch straight back to Local. The late
    // cloud render must not paint over the local half — and, the part that actually bites, must not leave ov.__cards
    // holding CLOUD rows under a LOCAL-looking list, where the next click opens or deletes the wrong workspace.
    await boot(page);
    await fakeDrive(page);
    let held;
    await page.route('https://www.googleapis.com/drive/v3/files?**', async (route) => {
        const q = decodeURIComponent((route.request().url().split('q=')[1] || '').split('&')[0]);
        if (/in parents/.test(q) && !/name=/.test(q)) { held = route; return; }   // hold the LISTING open
        route.fallback();
    });
    await page.evaluate(() => window.openWorkspaceManager('open', { place: 'local' }));   // t1265 — start local ON PURPOSE: the race is the switch TO cloud
    await page.locator('.wsm-place[data-place="cloud"]').click();
    await expect(page.locator('#wsmCards')).toContainText(/Reading your Drive/i);
    await page.locator('.wsm-place[data-place="local"]').click();
    await expect(page.locator('.wsm-folder-head'), 'we are back on the local half').toBeVisible();

    // now let the stale cloud listing arrive
    await held.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [
        { id: 'file-a', name: 'm350-shop.ddcs', mimeType: 'application/json', modifiedTime: '2026-07-24T10:00:00.000Z' },
    ] }) });
    await page.waitForTimeout(600);

    await expect(page.locator('.wsm-place[data-place="local"]'), 'the Local tab is still the active one').toHaveClass(/is-active/);
    await expect(page.locator('.wsm-folder-head'), 'and its folder head was not hidden by the late render').toBeVisible();
    await expect(page.locator('#wsmCloudBar'), 'no cloud account bar leaked onto the local half').toHaveCount(0);
    const rows = await page.evaluate(() => (document.querySelector('#wsmOverlay').__cards || []).map((c) => c.name));
    expect(rows, 'and the row MODEL a click reads is local, not the cloud list that lost the race').not.toContain('m350-shop.ddcs');
});
