import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';

/**
 * t2190 — THE PROJECT MANAGER (ui/projects/projectManager.js): the workspace-manager idiom, copied from the wizard
 * manager rather than invented — see scratchpad/t-projects-in-workspace.md and that file's own header comment.
 *
 * REPLACES three retired surfaces in one modal (#projmOverlay):
 *   - ui/libraryModal.js's openLibrary() — the old "Open" Projects modal (tested by the deleted library-854.spec.js)
 *   - ui/projects/projectModal.js's openSaveModal() — the old separate "Save" folder-tree modal (cloud-default-754's
 *     old subject; that spec is re-encoded here since Save no longer has a Cloud target at all — see below)
 *   - ui/projects/projectModal.js's openOpenDrawer()/renderCloudInto() — the dead-code drawer + its two independent
 *     select-then-load cloud roots (the deleted library-projects-cloud-863.spec.js and select-load-805.spec.js's
 *     projects-drawer tests; smalls-696.spec.js's drawer-resize test (c) is retired the same way — the resize
 *     handle was the drawer's own affordance, gone with it)
 *
 * THE ARCHITECTURE CHANGE THIS PROVES: Save writes into the WORKSPACE's own project store, always — there is no
 * more Local/Cloud SAVE TARGET (cloud-default-754's whole subject). Cloud participates only as an EXPORT
 * destination: Export copies a workspace project OUT (to a local file or Drive, asked once when there's a real
 * choice), Import copies a chosen file IN to the workspace's own list — never a live open straight from Drive.
 * This is why "a cloud write failure falls back to local" (the old Save behaviour) has no equivalent here: the
 * project is ALREADY saved locally (in the workspace) before Export ever runs, so an Export failure risks a
 * copy, never the source — nothing to fall back FROM.
 *
 * t2194 — the browsable LIBRARY SHELF (a granted local folder + a Drive file list, both browsable in-app) is
 * RETIRED: it misrepresented itself as a second container for your projects, "unimported" was a moment not a
 * place, and the OS file browser already does that browsing better. Import is now a plain OS file picker
 * (`#projmImportInput`); Export still writes to the same two destinations, chosen with a one-shot ask.
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function seed(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.openProjectManager, null, { timeout: 15000 });
    await page.evaluate(async () => {
        const store = await import('/ui/projects/projectStore.js');
        await store.saveProject('Bracket', { kind: 'ddcs.macro', v: 1, name: 'Bracket', stack: [{ type: 'op', opType: 'user_pocket_data' }] });
    });
}
async function openViaMenu(page) {
    await page.click('#hdrPostBtn');
    await page.click('#hdrPostMenu [data-act="library"]');
    await expect(page.locator('#projmOverlay')).toBeVisible();
    return page.locator('#projmOverlay');
}

test('the file menu\'s Open… row opens the ONE project manager — embedded count, row actions, no volume switcher', async ({ page }) => {
    await seed(page);
    const ov = await openViaMenu(page);
    await expect(ov.locator('.wsm-title')).toHaveText('Projects');
    await expect(ov.locator('#projmMine .wizm-title')).toContainText('This workspace — embedded in your .ddcs (1)');
    // NOT a Local/Cloud "volume" switcher inside the workspace section — that framing is exactly what t2190 removes
    await expect(ov.locator('#projmMine .proj-voltabs, #projmMine [data-vol]')).toHaveCount(0);
    const row = ov.locator('[data-prow="Bracket"]');
    await expect(row).toBeVisible();
    await expect(row.locator('[data-pm="open"]')).toBeVisible();
    await expect(row.locator('[data-pm="ren"]')).toBeVisible();
    await expect(row.locator('[data-pm="export"]')).toBeVisible();
    await expect(row.locator('[data-pm="del"]')).toBeVisible();
});

test('OPEN a row loads it and closes the manager (replaces the current program)', async ({ page }) => {
    await seed(page);
    const ov = await openViaMenu(page);
    await autoAppDialog(page, { accept: true });   // confirmDestructiveLoad's own ask
    await ov.locator('[data-prow="Bracket"] [data-pm="open"]').click();
    await expect(page.locator('#projmOverlay')).toHaveCount(0);
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).some((n) => n.opType === 'user_pocket_data')), 'the loaded stack replaced the editor').toBe(true);
});

test('FOLDERS survive the rewrite: + Folder, navigate in, a project saved there, breadcrumb back out', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'op', opType: 'pocket', label: 'Pocket', params: {}, children: [], simChildren: [] }]));
    const ov = await openViaMenu(page);
    await autoAppDialog(page, { accept: true, prompt: 'Jobs' });
    await ov.locator('[data-pm="mkdir"]').click();
    await expect(ov.locator('[data-frow="Jobs"]')).toBeVisible();
    await ov.locator('[data-frow="Jobs"] [data-pm="cd"]').click();
    await expect(ov.locator('#projmMine .wizm-crumb')).toContainText('Jobs');
    await autoAppDialog(page, { accept: true, prompt: 'Inner' });
    await ov.locator('[data-pm="save"]').click();
    await expect(ov.locator('[data-prow="Jobs/Inner"]')).toBeVisible();
    // back out via the breadcrumb — the folder's contents are not shown at the root
    await ov.locator('#projmMine .wizm-crumb-link', { hasText: 'This workspace' }).click();
    await expect(ov.locator('[data-prow="Jobs/Inner"]')).toHaveCount(0);
    await expect(ov.locator('[data-frow="Jobs"]')).toBeVisible();
});

test('SAVE CURRENT PROGRAM: one prompt (like a wizard Duplicate), lands in the workspace list, count updates', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'op', opType: 'pocket', label: 'Pocket', params: {}, children: [], simChildren: [] }]));
    const ov = await openViaMenu(page);
    await autoAppDialog(page, { accept: true, prompt: 'NewOne' });
    await ov.locator('[data-pm="save"]').click();
    await expect(ov.locator('[data-prow="NewOne"]')).toBeVisible();
    await expect(ov.locator('#projmMine .wizm-title')).toContainText('(2)');
});

test('the file menu\'s Save… row opens the SAME manager and fires the save prompt immediately', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'op', opType: 'pocket', label: 'Pocket', params: {}, children: [], simChildren: [] }]));
    await autoAppDialog(page, { accept: true, prompt: 'ViaMenu' });
    await page.click('#hdrPostBtn');
    await page.click('[data-act="projSave"]');
    await expect(page.locator('#projmOverlay')).toBeVisible();
    await expect(page.locator('#projmOverlay [data-prow="ViaMenu"]')).toBeVisible({ timeout: 5000 });
});

test('RENAME and DELETE a row', async ({ page }) => {
    await seed(page);
    const ov = await openViaMenu(page);
    await autoAppDialog(page, { accept: true, prompt: 'Renamed' });
    await ov.locator('[data-prow="Bracket"] [data-pm="ren"]').click();
    await expect(ov.locator('[data-prow="Renamed"]')).toBeVisible();
    await autoAppDialog(page, { accept: true });
    await ov.locator('[data-prow="Renamed"] [data-pm="del"]').click();
    await expect(ov.locator('[data-prow="Renamed"]')).toHaveCount(0);
    await expect(ov.locator('#projmMine .wsm-empty')).toBeVisible();
});

// A fake granted library folder — the wizard-manager-1617/library-sources-1247 rig, verbatim: real files in a Map.
async function grantLibrary(page, seed = {}) {
    await page.evaluate((files) => {
        const map = window.__lib = new Map(Object.entries(files));
        const fileHandle = (n) => ({
            kind: 'file', name: n,
            getFile: async () => new File([map.get(n)], n),
            createWritable: async () => ({ write: async (t) => map.set(n, t), close: async () => {} }),
            queryPermission: async () => 'granted',
        });
        window.showDirectoryPicker = async () => ({
            kind: 'directory', name: 'DDCS Library',
            queryPermission: async () => 'granted',
            requestPermission: async () => 'granted',
            async *entries() { for (const n of [...map.keys()]) yield [n, fileHandle(n)]; },
            getFileHandle: async (n, opts) => {
                if (!map.has(n)) {
                    if (!opts || !opts.create) throw new Error('not found');
                    map.set(n, '');
                }
                return fileHandle(n);
            },
            removeEntry: async (n) => { if (!map.delete(n)) throw new Error('not found'); },
        });
    }, seed);
}

test('t2194 — EXPORT writes a .mjson to the granted local library folder (signed out: no destination ask, straight to local)', async ({ page }) => {
    await seed(page);
    await grantLibrary(page);
    const ov = await openViaMenu(page);
    await autoAppDialog(page, { accept: true });   // the "Saved to your library folder" notice
    await ov.locator('[data-prow="Bracket"] [data-pm="export"]').click();
    await page.waitForFunction(() => window.__lib && window.__lib.has('Bracket.mjson'), null, { timeout: 8000 });
    const written = await page.evaluate(() => window.__lib.get('Bracket.mjson'));
    expect(JSON.parse(written).name, 'the exported file carries the stored project, not the live editor').toBe('Bracket');
});

test('t2194 — EXPORT signed IN asks local vs cloud; choosing Cloud writes to Drive, not the local folder', async ({ page }) => {
    await installDriveMock(page);
    await seed(page);
    const ov = await openViaMenu(page);
    await ov.locator('[data-prow="Bracket"] [data-pm="export"]').click();
    const dlg = page.locator('.app-dialog').last();
    await dlg.waitFor({ state: 'visible', timeout: 8000 });
    await expect(dlg, 'the ask names both real destinations').toContainText('Local file');
    await expect(dlg).toContainText('Cloud');
    await dlg.locator('button', { hasText: 'Cloud' }).click();
    await autoAppDialog(page, { accept: true });   // "Saved to your Drive app folder"
    await page.waitForFunction(() => window.__drive && window.__drive.writes.length === 1, null, { timeout: 8000 });
    // the write is a multipart upload body (googleDrive.js's own format) — a raw-text CONTAINS check, matching
    // wizard-manager-1617.spec.js's own equivalent, not a JSON.parse of the whole multipart envelope.
    const upload = await page.evaluate(() => window.__drive.writes[0]);
    expect(upload, 'the Drive upload carries the stored project, under its own name').toContain('Bracket.mjson');
    expect(upload).toContain('"name": "Bracket"');
});

// t2194 — the browsable LIBRARY (local folder shelf + Drive shelf) is RETIRED entirely — see this file's own
// header. Import is a plain OS file picker now (#projmImportInput), tested directly below rather than through a
// listing: it does not distinguish where a file came from, so there is no separate "cloud import" any more.
test('t2194 — IMPORT via the file picker lands a .mjson in the workspace list, not an immediate open', async ({ page }) => {
    await seed(page);
    const ov = await openViaMenu(page);
    const fileText = JSON.stringify({ kind: 'ddcs.macro', v: 1, name: 'widget', stack: [{ type: 'op', opType: 'user_pocket_data' }] });
    await autoAppDialog(page, { accept: true });   // "is in this workspace now"
    await page.setInputFiles('#projmImportInput', { name: 'widget.mjson', mimeType: 'application/json', buffer: Buffer.from(fileText) });
    await expect(page.locator('#projmOverlay')).toBeVisible();
    await expect(ov.locator('[data-prow="widget"]')).toBeVisible();
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).some((n) => n.opType === 'user_pocket_data')), 'import does not touch the live editor').toBe(false);
});

// t2194 — extended with an upload/write handler (the shelf-listing tests that only needed GETs are retired; the
// EXPORT-to-cloud test above needs the multipart POST/PATCH path, matching wizard-manager-1617.spec.js's fakeDrive).
async function installDriveMock(page) {
    await page.addInitScript(() => {
        localStorage.setItem('ddcs_cloud_token', 'faketoken');
        localStorage.setItem('ddcs_cloud_provider', 'google');
        localStorage.setItem('ddcs_gdrive_folder', 'ROOT');
        window.__drive = { writes: [] };
    });
    const FOLDER = 'application/vnd.google-apps.folder';
    const files = {
        ROOT: { id: 'ROOT', name: 'DDCS Studio', mimeType: FOLDER, parents: [], modifiedTime: '2024-01-01T00:00:00Z', content: null },
    };
    await page.route('https://www.googleapis.com/**', async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const path = url.pathname, method = req.method();
        const json = (obj, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
        if (method === 'GET' && url.searchParams.get('alt') === 'media') { const id = path.split('/').pop(); return json(files[id] ? files[id].content : {}); }
        if (method === 'GET' && path.endsWith('/drive/v3/files')) {
            const q = url.searchParams.get('q') || '';
            const parent = (q.match(/'([^']+)' in parents/) || [])[1];
            let list = Object.values(files).filter((f) => !f.trashed);
            if (parent) list = list.filter((f) => (f.parents || []).includes(parent));
            return json({ files: list.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime })) });
        }
        if (method === 'GET' && /\/drive\/v3\/files\/[^/?]+$/.test(path)) { const id = path.split('/').pop(); const f = files[id]; return json(f ? { id: f.id, trashed: !!f.trashed } : {}); }
        if (/\/upload\/drive\/v3\/files/.test(path)) {
            await page.evaluate((b) => window.__drive.writes.push(b), route.request().postData() || '');
            return json({ id: 'new-file' });
        }
        return json({});
    });
}

test('reachable + legible at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await seed(page);
    const ov = await openViaMenu(page);   // openViaMenu itself opens the menu — a prior open+close here would toggle it shut
    await expect(ov).toBeVisible();
});
