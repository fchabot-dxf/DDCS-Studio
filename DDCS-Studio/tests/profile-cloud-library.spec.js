import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';   // t684 b/d — the profile modal + in-app dialogs

/**
 * CLOUD LIBRARY UNIFICATION (t660, E2). Save-to-cloud / Load-from-cloud are views over the SAME named-profile concept:
 *  - Save pushes the ACTIVE named profile; the profile's NAME is the cloud name.
 *  - Load lands the cloud copy as a NEW named LIBRARY profile (the importAsProfile path — full swap, becomes active).
 *  - The local list + cloud list render as ONE library UI, rows tagged local / cloud / both.
 *  - No silent overwrite: pushing a name that already exists on cloud asks first.
 * Test 1 exercises the REAL round-trip through data/profileStore + googleDrive with an in-memory Drive (page.route
 * intercepts googleapis.com — "mock the Drive client"). Test 2 drives the unified UI with a stubbed cloud client.
 */

// An in-memory Google Drive behind page.route — implements just the v3 endpoints googleDrive.js uses.
async function installDriveMock(page) {
    await page.addInitScript(() => {
        localStorage.setItem('ddcs_cloud_token', 'faketoken');   // cloudConnected() → true
        localStorage.setItem('ddcs_gdrive_folder', 'ROOT');       // skip the ensureRoot search/create
        localStorage.removeItem('ddcs_profile_library');          // force a fresh migration
    });
    const FOLDER = 'application/vnd.google-apps.folder';
    const files = { ROOT: { id: 'ROOT', name: 'DDCS Studio', mimeType: FOLDER, parents: [], modifiedTime: '2024-01-01T00:00:00Z', content: null } };
    let next = 1;
    await page.route('https://www.googleapis.com/**', async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const path = url.pathname;
        const method = req.method();
        const json = (obj, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });

        // media read: GET /drive/v3/files/{id}?alt=media
        if (method === 'GET' && url.searchParams.get('alt') === 'media') {
            const id = path.split('/').pop();
            return json(files[id] ? files[id].content : {});
        }
        // list / search: GET /drive/v3/files?q=...
        if (method === 'GET' && path.endsWith('/drive/v3/files')) {
            const q = url.searchParams.get('q') || '';
            const parent = (q.match(/'([^']+)' in parents/) || [])[1];
            const name = (q.match(/name='([^']*)'/) || [])[1];
            const mime = (q.match(/mimeType='([^']*)'/) || [])[1];
            let list = Object.values(files).filter((f) => !f.trashed);
            if (parent) list = list.filter((f) => (f.parents || []).includes(parent));
            if (name != null) list = list.filter((f) => f.name === name);
            if (mime != null) list = list.filter((f) => f.mimeType === mime);
            return json({ files: list.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime })) });
        }
        // single-file existence check (ensureRoot): GET /drive/v3/files/{id}?fields=id,trashed
        if (method === 'GET' && /\/drive\/v3\/files\/[^/?]+$/.test(path)) {
            const id = path.split('/').pop();
            const f = files[id];
            return json(f ? { id: f.id, trashed: !!f.trashed } : {});
        }
        // upload create (multipart): POST /upload/drive/v3/files  (check BEFORE the plain create — both end with /drive/v3/files)
        if (method === 'POST' && path.endsWith('/upload/drive/v3/files')) {
            const boundary = ((req.headers()['content-type'] || '').match(/boundary=(.+)/) || [])[1];
            const body = req.postData() || '';
            const grab = (seg) => { const i = seg.indexOf('\r\n\r\n'); return JSON.parse((i >= 0 ? seg.slice(i + 4) : seg).trim()); };
            const segs = body.split('--' + boundary).filter((s) => s.includes('{'));
            const meta = grab(segs[0]);
            const content = grab(segs[1]);
            const id = 'f' + (next++);
            files[id] = { id, name: meta.name, mimeType: 'application/json', parents: meta.parents || [], modifiedTime: '2024-06-02T00:00:00Z', content };
            return json({ id });
        }
        // create folder / metadata: POST /drive/v3/files (mkdir) — after the /upload/ branch above
        if (method === 'POST' && path.endsWith('/drive/v3/files')) {
            const meta = JSON.parse(req.postData() || '{}');
            const id = 'f' + (next++);
            files[id] = { id, name: meta.name, mimeType: meta.mimeType || 'application/json', parents: meta.parents || [], modifiedTime: '2024-06-01T00:00:00Z', content: null };
            return json({ id });
        }
        // upload update (media): PATCH /upload/drive/v3/files/{id}
        if (method === 'PATCH' && /\/upload\/drive\/v3\/files\/[^/?]+$/.test(path)) {
            const id = path.split('/').pop();
            if (files[id]) files[id].content = JSON.parse(req.postData() || '{}');
            return json({ id });
        }
        // delete
        if (method === 'DELETE') {
            const id = path.split('/').pop();
            delete files[id];
            return route.fulfill({ status: 204, body: '' });
        }
        return json({});
    });
}

test('cloud round-trip: Save pushes the ACTIVE profile under its name; Load lands it as a named library profile (real Drive mock)', async ({ page }) => {
    await installDriveMock(page);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsProfileLib && window.ddcsSaveProfileToCloud && window.ddcsListCloudProfiles && window.ddcsLoadCloudProfile && window.ddcsGetSettings);

    // name the active profile + a distinctive envelope, snapshot, push to cloud under its name
    const afterPush = await page.evaluate(async () => {
        const lib = window.ddcsProfileLib;
        lib.renameProfile(lib.activeProfileId(), 'Rig Alpha');
        window.ddcsGetSettings().machine = { x: 642, y: 400, z: 300, show: true };
        lib.saveActiveSnapshot();
        await window.ddcsSaveProfileToCloud('Rig Alpha');
        const list = await window.ddcsListCloudProfiles();
        return { names: list.map((c) => c.name) };
    });
    expect(afterPush.names, 'the pushed profile appears on cloud under its own name').toContain('Rig Alpha');

    // switch to a DIFFERENT local baseline (active ≠ Rig Alpha), then LOAD the cloud copy back
    const afterLoad = await page.evaluate(async () => {
        const lib = window.ddcsProfileLib;
        lib.createProfile({ from: 'baseline', controllerId: 'ddcs-expert-m350', name: 'Other rig' });
        window.ddcsGetSettings().machine = { x: 111, y: 1, z: 1, show: true };
        lib.saveActiveSnapshot();
        const alpha = (await window.ddcsListCloudProfiles()).find((c) => c.name === 'Rig Alpha');
        await window.ddcsLoadCloudProfile(alpha.id);   // → importAsProfile → NEW named profile, becomes active
        return {
            activeName: lib.activeProfile().name,
            envX: window.ddcsGetSettings().machine.x,
            hasAlpha: lib.listProfiles().some((p) => p.name === 'Rig Alpha'),
        };
    });
    expect(afterLoad.activeName, 'the loaded cloud profile is now the active LIBRARY profile, named = the cloud name').toBe('Rig Alpha');
    expect(afterLoad.envX, 'the loaded profile carried its own envelope (642), full-swapped in — not the 111 baseline').toBe(642);
    expect(afterLoad.hasAlpha, 'a named "Rig Alpha" library entry now exists locally (importAsProfile landing)').toBe(true);
});

test('the unified library renders local + cloud + both rows; Save pushes the active name and asks before overwrite', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsProfileLib && window.ddcsGetSettings);
    // fresh library with 2 local profiles; stub the cloud client: one name matches a local (→ both), one is cloud-only
    await page.evaluate(() => {
        localStorage.removeItem('ddcs_profile_library');
        const lib = window.ddcsProfileLib;
        lib.renameProfile(lib.activeProfileId(), 'Shared rig');       // will be tagged 'both' (matches a cloud name)
        lib.saveActiveSnapshot();
        lib.createProfile({ from: 'baseline', controllerId: 'ddcs-expert-m350', name: 'Local only' });   // active, tagged 'local'
        window.ddcsListCloudProfiles = async () => ([
            { id: 'c1', name: 'Shared rig', savedAt: '2024-06-01T00:00:00Z' },
            { id: 'c2', name: 'Cloud only', savedAt: '2024-06-02T00:00:00Z' },
        ]);
        window.__savedName = null;
        window.ddcsSaveProfileToCloud = async (n) => { window.__savedName = n; return n; };
    });
    await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_profile' }));
    await page.waitForSelector('#set_profile_browse');
    await page.click('#set_profile_browse');   // the PROFILE BROWSER MODAL auto-syncs the cloud on open
    await page.waitForSelector('.profile-modal .prof-row');
    await page.waitForTimeout(200);

    const rows = await page.evaluate(() => {
        const list = document.querySelector('.profile-modal [data-plist]');
        return {
            localCount: list.querySelectorAll('.prof-row[data-pid]').length,
            // t805 SELECT-THEN-LOAD: the cloud-only profile is a selectable sl-row (loaded via the dedicated [Load]),
            // not a per-row Load button; a matched-local name collapses to ONE synced local row (no cloud-only row).
            cloudOnlyRow: !!list.querySelector('.sl-row[data-sl-kind="cloud"][data-sl-id="c2"]'),
            sharedIsNotACloudRow: !list.querySelector('.sl-row[data-sl-kind="cloud"][data-sl-id="c1"]'),
            synced: /☁ synced/.test(list.innerHTML),                           // the matched local shows the synced tag
            text: list.textContent,
        };
    });
    expect(rows.localCount, 'two local rows (Shared rig + Local only)').toBe(2);
    expect(rows.cloudOnlyRow, 'the cloud-only profile is a selectable cloud row').toBe(true);
    expect(rows.sharedIsNotACloudRow, 'a cloud name that exists locally is one "synced" row, not duplicated').toBe(true);
    expect(rows.synced, 'the matched local carries a ☁ synced tag').toBe(true);
    expect(rows.text, 'the cloud-only profile is visible in the one list').toContain('Cloud only');

    // Save-to-cloud pushes the ACTIVE profile under ITS name. Active = 'Local only' (not on cloud) → saves; dismiss the "saved" notice.
    await autoAppDialog(page, { accept: true });
    await page.click('.profile-modal [data-pa="cloudsave"]');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__savedName), 'Save pushes the active profile under its own name').toBe('Local only');

    // switch active to 'Shared rig' (name IS on cloud) → Save must ASK before overwriting; cancel → no push (no silent overwrite)
    // t805 SELECT-THEN-LOAD: select the row, then the dedicated [Load]
    await page.evaluate(() => { window.__savedName = null; const r = [...document.querySelectorAll('.profile-modal .prof-row[data-pid]')].find((x) => /Shared rig/.test(x.textContent)); r.querySelector('.sl-name').click(); });
    await page.click('.profile-modal [data-sl-primary]');
    await page.waitForTimeout(150);
    await autoAppDialog(page, { accept: false });   // the overwrite confirm → Cancel
    await page.click('.profile-modal [data-pa="cloudsave"]');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__savedName), 'cancelling the overwrite confirm does NOT push — no silent overwrite').toBeNull();
});
