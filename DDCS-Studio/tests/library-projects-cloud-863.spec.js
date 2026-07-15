import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';

/**
 * t863 — THE PROJECTS-CLOUD REFACTOR. The Library Projects tab now hosts BOTH volumes (Local + Cloud) as two SEPARATE
 * select-then-load roots (#libProjLocal / #libProjCloud, each with its own [data-sl-primary]), via the reusable
 * `renderCloudInto` factored off the drawer singletons — each mount owns its OWN cloud folder stack (closure, not the
 * old module `cloudStack`). The 📂 Open header button DEEP-LINKS here (the drawer is no longer an entry point).
 *
 * Asserts: both roots select-then-load, folder nav in both, save-as round-trips through the Library door, the deep-link
 * opens the Library (not the drawer), and NO singleton folder-state leaks between the drawer's cloud + the Library's
 * (open both surfaces in one session — each keeps its own crumb after the other re-renders).
 */
test.use({ viewport: { width: 1300, height: 980 } });

// An in-memory Google Drive behind page.route (the t805/t806 pattern): ROOT + a Jobs subfolder + one file at each level.
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
        p2: { id: 'p2', name: 'inner.mjson', mimeType: 'application/json', parents: ['sub1'], modifiedTime: '2024-06-03T00:00:00Z', content: { kind: 'ddcs.project', v: 1, name: 'inner', stack: [] } },
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
        return json({});
    });
}

const READY = () => window.ddcsStudio && window.openLibrary && document.getElementById('projOpenBtn');

// Seed a couple of LOCAL projects + a folder (the projectStore API — deterministic, no editor state needed).
async function seedLocal(page) {
    await page.evaluate(async () => {
        const store = await import('/ui/projects/projectStore.js');
        await store.saveProject('Bracket', { kind: 'ddcs.project', v: 1, name: 'Bracket', stack: [] });
        await store.mkdir('Jobs');
        await store.saveProject('Jobs/Plate', { kind: 'ddcs.project', v: 1, name: 'Plate', stack: [] });
    });
}

// THE DEEP-LINK under test: #projOpenBtn's wiring (macroBar → openLibrary('projects')). The button is a stable HIDDEN
// proxy target (.macro-bar is display:none), so we fire its click programmatically — exactly what any proxy caller does —
// bypassing Playwright's visibility gate on the intentionally-hidden element. This IS the wiring t863 retired to the Library.
// Poll-click: initMacroBar attaches the listener at boot; retry the click until the overlay appears (avoids the boot race).
async function openViaDeepLink(page) {
    const ov = page.locator('#libraryOverlay');
    await expect(async () => {
        await page.evaluate(() => document.getElementById('projOpenBtn').click());
        await expect(ov).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    await expect(ov.locator('.library-tab[data-lib-tab="projects"]')).toHaveClass(/active/);
    return ov;
}

test('the 📂 Open header button DEEP-LINKS to the Library Projects tab (not the drawer), with Local + Cloud volumes', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(READY, null, { timeout: 15000 });
    await seedLocal(page);
    const ov = await openViaDeepLink(page);
    // NOT the drawer — the .proj-drawer aside is lazily built and the deep-link never creates it
    await expect(page.locator('.proj-drawer')).toHaveCount(0);
    // both volume tabs, Local active by default
    await expect(ov.locator('.proj-voltab[data-lvol="local"]')).toBeVisible();
    await expect(ov.locator('.proj-voltab[data-lvol="cloud"]')).toBeVisible();
    await expect(ov.locator('.proj-voltab[data-lvol="local"]')).toHaveClass(/on/);
    // the two roots exist as SEPARATE containers; the local one shows the seeded project
    await expect(ov.locator('#libProjLocal')).toHaveCount(1);
    await expect(ov.locator('#libProjCloud')).toHaveCount(1);
    await expect(ov.locator('#libProjLocal .sl-row', { hasText: 'Bracket' })).toBeVisible();
});

test('LOCAL root — folder navigation + select-then-load (Open disabled until selected, commit loads + closes)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(READY, null, { timeout: 15000 });
    await seedLocal(page);
    const ov = await openViaDeepLink(page);
    const local = ov.locator('#libProjLocal');
    // FOLDER NAV: the Jobs folder navigates → the inner Plate project appears, the crumb gains a segment
    await local.locator('.lib-name', { hasText: 'Jobs' }).click();
    await expect(local.locator('.sl-row', { hasText: 'Plate' })).toBeVisible();
    await expect(local.locator('.lib-crumb-link')).toHaveCount(2);   // Local / Jobs
    // back to root via the crumb
    await local.locator('.lib-crumb-link', { hasText: 'Local' }).click();
    await expect(local.locator('.sl-row', { hasText: 'Bracket' })).toBeVisible();
    // SELECT-THEN-LOAD: this root's own [Open] is disabled until a row selects
    const openBtn = local.locator('[data-sl-primary]');
    await expect(openBtn).toBeDisabled();
    await local.locator('.sl-row', { hasText: 'Bracket' }).click();
    await expect(local.locator('.sl-row.sl-selected')).toHaveCount(1);
    await expect(openBtn).toBeEnabled();
    await openBtn.click();
    await expect(page.locator('#libraryOverlay')).toHaveCount(0);   // committed → loaded → the Library closed
});

test('CLOUD root — keyless list + folder navigation + select-then-load (a SECOND independent select-load root)', async ({ page }) => {
    await installDriveMock(page);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(READY, null, { timeout: 15000 });
    const ov = await openViaDeepLink(page);
    await ov.locator('.proj-voltab[data-lvol="cloud"]').click();
    const cloud = ov.locator('#libProjCloud');
    // the keyless drive.file listing rendered — one project at ROOT (widget.mjson) + the Jobs folder
    await expect(cloud.locator('.sl-row')).toHaveCount(1);
    const openBtn = cloud.locator('[data-sl-primary]');
    await expect(openBtn).toHaveCount(1);
    await expect(openBtn).toBeDisabled();
    // FOLDER NAV: Jobs → the inner project appears, the crumb gains a segment (Drive / Jobs)
    await cloud.locator('.proj-name', { hasText: 'Jobs' }).click();
    await expect(cloud.locator('.sl-row', { hasText: 'inner' })).toBeVisible();
    await expect(cloud.locator('.proj-crumb-link')).toHaveCount(2);
    // SELECT-THEN-LOAD the cloud project → loads + the Library closes
    await cloud.locator('.sl-row', { hasText: 'inner' }).click();
    await expect(cloud.locator('.sl-row.sl-selected')).toHaveCount(1);
    await expect(openBtn).toBeEnabled();
    await openBtn.click();
    await expect(page.locator('#libraryOverlay')).toHaveCount(0);
});

test('save-as ROUND-TRIPS through the Library door: Save current… → save modal → the project reappears + reloads', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(READY, null, { timeout: 15000 });
    await autoAppDialog(page, { accept: true });   // dismiss any save-location note
    // openSaveModal guards on a non-empty program — seed a minimal op stack so the save door actually opens the modal.
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'op', opType: 'pocket', label: 'Pocket', params: {}, children: [{ type: 'move', params: { x: 0, y: 0, z: -1, mode: 'rapid' } }], simChildren: [] }]));
    let ov = await openViaDeepLink(page);
    // the save door lives in the local head; it closes the Library and opens the focused save modal
    await ov.locator('#libProjLocal [data-pa="save"]').click();
    await expect(page.locator('#libraryOverlay')).toHaveCount(0);
    await expect(page.locator('.proj-savemodal')).toBeVisible();
    await page.click('.proj-savemodal [data-starget="local"]');   // force the local target (deterministic; no cloud)
    await page.fill('#projSaveName', 'RoundTrip');
    await page.click('.proj-savemodal [data-sact="save"]');
    await expect(page.locator('.proj-savemodal')).toBeHidden();
    // reopen the Library → the saved project is listed and select-then-loads
    ov = await openViaDeepLink(page);
    const row = ov.locator('#libProjLocal .sl-row', { hasText: 'RoundTrip' });
    await expect(row).toBeVisible();
    await row.click();
    const openBtn = ov.locator('#libProjLocal [data-sl-primary]');
    await expect(openBtn).toBeEnabled();
    await openBtn.click();
    await expect(page.locator('#libraryOverlay')).toHaveCount(0);
});

test('NO singleton leak: the drawer cloud + the Library cloud keep INDEPENDENT folder stacks (both open in one session)', async ({ page }) => {
    await installDriveMock(page);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(READY, null, { timeout: 15000 });
    // 1) open the DRAWER (legacy surface, still mounted for save flows) → cloud → navigate INTO Jobs
    await page.evaluate(async () => { const m = await import('/ui/projects/projectModal.js'); m.openOpenDrawer(); });
    await page.click('.proj-drawer .proj-voltab[data-vol="cloud"]');
    await page.waitForSelector('.proj-drawer #projCloudMount .proj-name');
    await page.locator('.proj-drawer #projCloudMount .proj-name', { hasText: 'Jobs' }).click();
    await expect(page.locator('.proj-drawer #projCloudMount .proj-crumb-link')).toHaveCount(2);   // Drive / Jobs
    // 2) open the LIBRARY cloud → it starts FRESH at Drive (did NOT inherit the drawer's Jobs — separate closure stack)
    await page.evaluate(() => window.openLibrary('projects'));
    await page.click('#libraryOverlay .proj-voltab[data-lvol="cloud"]');
    await page.waitForSelector('#libProjCloud .proj-name');
    await expect(page.locator('#libProjCloud .proj-crumb-link')).toHaveCount(1);   // Drive only — no leak from the drawer
    // 3) re-render the DRAWER via its cloud-account listener → it STILL reads its OWN stack (Jobs), not the Library's Drive
    //    (the discriminating step: with the old shared `cloudStack`, the drawer would jump to Drive here.)
    await page.evaluate(() => window.dispatchEvent(new Event('ddcs:cloud-account')));
    await page.waitForTimeout(150);
    await expect(page.locator('.proj-drawer #projCloudMount .proj-crumb-link')).toHaveCount(2);   // still Drive / Jobs
});
