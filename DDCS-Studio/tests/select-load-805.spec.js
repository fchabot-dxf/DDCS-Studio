import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';

/**
 * t805 — SELECT-THEN-LOAD across BOTH file browsers (projects + profiles, local + cloud) + the Drive-connect
 * "wonky" fix. The ruled model: a row SELECTS (one at a time, accent ring); a dedicated primary button
 * ([Open]/[Load], disabled until a selection) or a double-click LOADS; the ACTIVE profile is badged distinct
 * from the selection; folders navigate on their own click; no dead connect buttons.
 * The projects-cloud test uses an in-memory Drive (page.route over googleapis.com) seeded with one app-created
 * project — the keyless drive.file listing (no Picker API key).
 */

// An in-memory Google Drive behind page.route, seeded with one project under ROOT (keyless drive.file listing).
async function installDriveMock(page) {
    await page.addInitScript(() => {
        localStorage.setItem('ddcs_cloud_token', 'faketoken');     // getAccount().connected → true
        localStorage.setItem('ddcs_cloud_provider', 'google');     // provider === google → the real cloud browse renders
        localStorage.setItem('ddcs_gdrive_folder', 'ROOT');        // skip the ensureRoot search/create
    });
    const FOLDER = 'application/vnd.google-apps.folder';
    const files = {
        ROOT: { id: 'ROOT', name: 'DDCS Studio', mimeType: FOLDER, parents: [], modifiedTime: '2024-01-01T00:00:00Z', content: null },
        sub1: { id: 'sub1', name: 'Jobs', mimeType: FOLDER, parents: ['ROOT'], modifiedTime: '2024-02-01T00:00:00Z', content: null },
        p1: { id: 'p1', name: 'widget.mjson', mimeType: 'application/json', parents: ['ROOT'], modifiedTime: '2024-06-02T00:00:00Z', content: { kind: 'ddcs.project', v: 1, name: 'widget', stack: [] } },
    };
    let next = 1;
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
        return json({});
    });
}

// Open the drawer via the module directly (ESM singleton) — deterministic, no dependence on any header button's
// boot-time wiring. t2184 — macroBar.js (and the #projOpenBtn readiness proxy this file used to poll for) is
// deleted entirely; the boot-readiness gate above now waits on the standard ddcsReady flag instead.
const openProjectsDrawer = (page) => page.evaluate(async () => { const m = await import('/ui/projects/projectModal.js'); m.openOpenDrawer(); });

test('projects CLOUD: keyless list + SELECT-THEN-[Open] — Open disabled until a file is selected, then loads (folders navigate)', async ({ page }) => {
    await installDriveMock(page);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsLoadBlockStack && document.documentElement.dataset.ddcsReady === '1');
    await openProjectsDrawer(page);
    await page.click('.proj-voltab[data-vol="cloud"]');
    await page.waitForSelector('#projCloudMount .sl-row', { timeout: 15000 });   // the keyless drive.file listing rendered

    // the dedicated [Open] exists and is DISABLED until a selection (no row-click-that-loads)
    const openBtn = page.locator('#projCloud [data-sl-primary]');
    await expect(openBtn, 'a dedicated Open button exists').toHaveCount(1);
    expect(await openBtn.isDisabled(), 'Open is disabled with nothing selected').toBe(true);

    // a FOLDER navigates on single click (it is not an sl-row) — the crumb grows to include it (async re-render)
    await page.click('#projCloudMount .proj-row:not(.sl-row) .proj-name');   // 📁 Jobs
    await expect(page.locator('#projCloudMount .proj-crumb'), 'entered the folder (crumb shows Jobs)').toContainText('Jobs', { timeout: 8000 });
    // back to root
    await page.locator('#projCloudMount .proj-crumb-link').first().click();
    await page.waitForSelector('#projCloudMount .sl-row[data-sl-id="p1"]', { timeout: 8000 });

    // SELECT the project file → Open enables; exactly one selected row
    await page.click('#projCloudMount .sl-row[data-sl-id="p1"] .sl-name');
    await expect(page.locator('#projCloudMount .sl-row.sl-selected')).toHaveCount(1);
    expect(await openBtn.isDisabled(), 'Open enables once a file is selected').toBe(false);

    // click Open → loads the selected project (drawer closes)
    await openBtn.click();
    await expect(page.locator('.proj-drawer')).toBeHidden({ timeout: 8000 });
});

test('projects CLOUD: DOUBLE-CLICK a file is the shortcut (loads immediately)', async ({ page }) => {
    await installDriveMock(page);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsLoadBlockStack && document.documentElement.dataset.ddcsReady === '1');
    await openProjectsDrawer(page);
    await page.click('.proj-voltab[data-vol="cloud"]');
    await page.waitForSelector('#projCloudMount .sl-row[data-sl-id="p1"]', { timeout: 15000 });
    await page.locator('#projCloudMount .sl-row[data-sl-id="p1"] .sl-name').dblclick();
    await expect(page.locator('.proj-drawer'), 'double-click opens without needing the button').toBeHidden({ timeout: 8000 });
});

test('the WONKY fix: the disconnected Cloud tab offers ONLY wired providers (no dead Dropbox/OneDrive buttons)', async ({ page }) => {
    await page.addInitScript(() => { localStorage.removeItem('ddcs_cloud_token'); localStorage.removeItem('ddcs_cloud_provider'); });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await openProjectsDrawer(page);
    await page.click('.proj-voltab[data-vol="cloud"]');
    await page.waitForSelector('#projCloudMount .cloud-connect', { timeout: 15000 });
    const labels = await page.locator('#projCloudMount .cloud-connect').allTextContents();
    expect(labels.length, 'exactly one connect button (google) — no dead-end providers').toBe(1);
    expect(labels.join(' ').toLowerCase(), 'only Google is offered').toContain('google');
    expect(labels.join(' ').toLowerCase(), 'no Dropbox connect button').not.toContain('dropbox');
    expect(labels.join(' ').toLowerCase(), 'no OneDrive connect button').not.toContain('onedrive');
});

test('projects LOCAL: single-click selects one at a time (not load); folders still navigate', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && document.documentElement.dataset.ddcsReady === '1');
    // seed two local projects + a folder via the store
    await page.evaluate(async () => {
        const store = await import('/ui/projects/projectStore.js');
        const { serializeProject } = await import('/blocks/programFile.js');
        await store.mkdir('Bin');
        await store.saveProject('alpha', serializeProject('alpha'));
        await store.saveProject('beta', serializeProject('beta'));
    });
    await openProjectsDrawer(page);
    await page.waitForSelector('#projList .sl-row', { timeout: 8000 });
    const open = page.locator('#projLocal [data-sl-primary]');
    expect(await open.isDisabled(), 'Open disabled with nothing selected').toBe(true);
    const rows = page.locator('#projList .sl-row');
    expect(await rows.count(), 'two project rows (the folder is not an sl-row)').toBeGreaterThanOrEqual(2);
    await rows.nth(0).locator('.sl-name').click();
    await rows.nth(1).locator('.sl-name').click();
    expect(await page.locator('#projList .sl-row.sl-selected').count(), 'only ONE row selected at a time').toBe(1);
    expect(await open.isDisabled(), 'Open enabled after a selection').toBe(false);
    // the folder is a navigate button, not a selectable row
    expect(await page.locator('#projList .proj-row:not(.sl-row) [data-act="cd"]').count(), 'the folder navigates (not selectable)').toBeGreaterThanOrEqual(1);
});


// t1217 — the two PROFILES tests that lived here are RETIRED with the profile library
// ([[one-workspace-one-machine]]): a workspace holds exactly one machine, so there is no list of profiles to
// select from and no [Load] full-swap to assert. The select-then-load LANGUAGE these tests also covered is still
// exercised above by the projects rows, which is where it now lives exclusively.
