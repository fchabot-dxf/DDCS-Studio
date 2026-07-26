import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';   // t1219 — a cloud load is a destructive swap and now ASKS first

/**
 * CLOUD MACHINE ROUND-TRIP (t660 E2, rewritten t1217). Save-to-cloud / Load-from-cloud are views over THIS WORKSPACE'S
 * MACHINE ([[one-workspace-one-machine]]):
 *  - Save pushes this workspace's machine; the machine's NAME is the cloud name.
 *  - Load APPLIES the cloud copy to this workspace (a full swap — the workspace becomes that machine). It used to land
 *    as a new named LIBRARY entry; the library is retired, so there is nowhere else for it to go.
 * This exercises the REAL round-trip through data/profileStore + googleDrive with an in-memory Drive (page.route
 * intercepts googleapis.com — "mock the Drive client").
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

// t1217 — the cloud ROUND-TRIP survives the library retire, with a new landing: a cloud copy no longer becomes a new
// named library entry (there is no library), it is APPLIED to this workspace's machine ([[one-workspace-one-machine]]).
// The Drive plumbing is untouched, so this test still guards the real Save→List→Load path end to end.
test('cloud round-trip: Save pushes THIS WORKSPACE\'S MACHINE under its name; Load applies it back over the workspace (real Drive mock)', async ({ page }) => {
    await installDriveMock(page);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsSetMachine && window.ddcsSaveProfileToCloud && window.ddcsListCloudProfiles && window.ddcsLoadCloudProfile && window.ddcsGetSettings);
    await autoAppDialog(page, { accept: true });   // t1219 — the load asks before replacing this workspace's machine

    // name THIS workspace's machine + give it a distinctive envelope, then push to cloud under that name
    const afterPush = await page.evaluate(async () => {
        window.ddcsSetMachine({ name: 'Rig Alpha' }, false);
        window.ddcsGetSettings().machine = { x: 642, y: 400, z: 300, show: true };
        await window.ddcsSaveProfileToCloud('Rig Alpha');
        const list = await window.ddcsListCloudProfiles();
        return { names: list.map((c) => c.name) };
    });
    expect(afterPush.names, 'the pushed machine appears on cloud under its own name').toContain('Rig Alpha');

    // make this workspace a DIFFERENT machine, then LOAD the cloud copy back over it
    const afterLoad = await page.evaluate(async () => {
        window.ddcsSetMachine({ name: 'Other rig' }, false);
        window.ddcsGetSettings().machine = { x: 111, y: 1, z: 1, show: true };
        const alpha = (await window.ddcsListCloudProfiles()).find((c) => c.name === 'Rig Alpha');
        await window.ddcsLoadCloudProfile(alpha.id);   // t1217 → landImportedProfile → applied to THIS workspace
        return { machineName: window.ddcsGetMachine().name, envX: window.ddcsGetSettings().machine.x };
    });
    expect(afterLoad.machineName, 'the workspace now identifies as the loaded machine').toBe('Rig Alpha');
    expect(afterLoad.envX, 'the loaded machine carried its own envelope (642), full-swapped in — not the 111 it replaced').toBe(642);
});

/**
 * t1219 — a cloud load is a FULL SWAP of this workspace's machine, so it routes through the same declared safety gate
 * as a file import. Declining must leave the workspace untouched: the remote copy is the one thing a user cannot undo
 * by re-typing, and a mis-click here would replace a whole machine configuration.
 */
test('DECLINING a cloud load leaves this workspace untouched (the same gate as a file import)', async ({ page }) => {
    await installDriveMock(page);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsSetMachine && window.ddcsSaveProfileToCloud && window.ddcsListCloudProfiles && window.ddcsLoadCloudProfile && window.ddcsGetSettings);

    // put a machine on the cloud, then make this workspace a DIFFERENT one
    await autoAppDialog(page, { accept: true });
    await page.evaluate(async () => {
        window.ddcsSetMachine({ name: 'Rig Alpha', controllerId: 'ddcs-v41' }, true);
        window.ddcsGetSettings().machine = { x: 642, y: 400, z: 300, show: true };
        await window.ddcsSaveProfileToCloud('Rig Alpha');
        window.ddcsSetMachine({ name: 'Keep Me', controllerId: 'ddcs-expert-m350' }, true);
        window.ddcsGetSettings().machine = { x: 111, y: 1, z: 1, show: true };
    });

    await autoAppDialog(page, { accept: false });   // now the user DECLINES the load
    const after = await page.evaluate(async () => {
        const { getActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        const alpha = (await window.ddcsListCloudProfiles()).find((c) => c.name === 'Rig Alpha');
        const ret = await window.ddcsLoadCloudProfile(alpha.id);
        return {
            ret, machine: window.ddcsGetMachine(),
            controller: (getActiveProfile() || {}).id, envX: window.ddcsGetSettings().machine.x,
        };
    });

    expect(after.ret, 'a declined load reports that nothing landed').toBeNull();
    expect(after.machine.name, 'the workspace keeps its own machine').toBe('Keep Me');
    expect(after.controller, 'and its own controller — no wrong-dialect swap slipped through').toBe('ddcs-expert-m350');
    expect(after.envX, 'and its own envelope').toBe(111);
});

// t1217 — the second test here ('the unified library renders local + cloud + both rows') is RETIRED with the
// profile library ([[one-workspace-one-machine]]): there is no local-profile list to merge cloud rows into, so the
// unified-row rendering it asserted no longer exists. The cloud Save/List/Load plumbing it shared is still covered
// by the round-trip above.
