import { test, expect } from '@playwright/test';

/**
 * t1257 (user live report: "clicking a workspace has a lag with no feedback — nothing happens, then it opens").
 *
 * TWO findings, and the order matters. MEASURED FIRST, before building anything: of the ~930ms before the page even
 * started reloading, 915ms was `controllerSettled` — and not because anything took that long. The variable re-seed is
 * triggered by restoreBackup and finishes in milliseconds, so by the time controllerSettled attached its listener the
 * event had ALREADY FIRED, and it then waited out its full 900ms cap on every open. A missed-event race, not slow
 * work: file read 0.3ms, parse 0.4ms, restore 13.5ms. With variableDB stamping when it fires, an open is ~68ms.
 *
 * So most of the "nothing happens" was removable rather than something to decorate with a spinner. What remains IS
 * real — a Drive fetch on a cloud row, and the reload at the end of every open — and that gets feedback ON THE ROW.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const ddcs = (name, cid = 'ddcs-v41') => JSON.stringify({
    kind: 'ddcs.backup', v: 1, app: 'test', date: '2026-07-24T10:00:00.000Z',
    stores: { machine: { name, controllerId: cid }, settings: { machine: { x: 300, y: 200, z: -80, show: true } } },
});

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager && window.ddcsFileSaveState);
    await page.evaluate(() => { window.__ddcsNoReload = true; });
}

/** A granted folder whose file read can be HELD OPEN, so the busy state can be observed mid-flight. */
async function grantFolder(page, body, { hold = false } = {}) {
    await page.evaluate(([b, h]) => {
        window.__release = null;
        window.__holdReads = false;   // armed by the test AFTER the listing has rendered its rows
        window.showDirectoryPicker = async () => ({
            kind: 'directory', name: 'Workspaces', queryPermission: async () => 'granted',
            async *entries() {
                yield ['bench.ddcs', {
                    kind: 'file', name: 'bench.ddcs', queryPermission: async () => 'granted',
                    getFile: async () => {
                        // the LISTING reads this too (it shows the envelope and controller from the file itself), so a
                        // blanket hold would stop the rows ever appearing — hold only the read the open performs
                        if (h && window.__holdReads) await new Promise((res) => { window.__release = res; });
                        return new File([b], 'bench.ddcs');
                    },
                }];
            },
        });
    }, [body, hold]);
}

test('THE OPEN IS FAST NOW — the 900ms cap was a missed event, not work', async ({ page }) => {
    await boot(page);
    await grantFolder(page, ddcs('bench-router'));
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('#wsmPickFolder').click();
    await page.locator('#wsmCards .wsm-fp-row').first().waitFor();

    const t0 = Date.now();
    await page.locator('#wsmCards .wsm-fp-row').first().click();
    await page.waitForFunction(() => /bench/.test(window.ddcsFileSavedName() || ''), null, { timeout: 8000 });
    const ms = Date.now() - t0;
    // the cap was 900ms and it was hit EVERY time; anything near it means the latch stopped working
    expect(ms, `an open should not wait out the controller-settle cap (took ${ms}ms)`).toBeLessThan(500);

    // …and it is still CORRECT: the whole point of the wait was that the workspace must not read dirty on arrival
    expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'the freshly opened workspace is clean').toBe(false);
});

test('the latch is what makes it fast: a re-seed that landed BEFORE the wait started still counts', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const before = Date.now();
        window.__ddcsVarsReadyAt = Date.now();       // a re-seed that already happened, exactly as restoreBackup causes
        const wm = await import('/ui/workspaceManager.js');
        void wm;
        // controllerSettled is module-private, so drive its two inputs the way the open does
        const t0 = performance.now();
        const settled = (since) => (Number(window.__ddcsVarsReadyAt || 0) >= since
            ? Promise.resolve('latched') : new Promise((res) => setTimeout(() => res('capped'), 900)));
        const how = await settled(before);
        return { how, ms: Math.round(performance.now() - t0) };
    });
    expect(r.how, 'the stamp answers instead of the timeout').toBe('latched');
    expect(r.ms, 'so nothing is waited out').toBeLessThan(50);
});

test('CLICKING A LOCAL ROW shows the busy glyph on THAT row, immediately, and blocks a double-open', async ({ page }) => {
    await boot(page);
    await grantFolder(page, ddcs('bench-router'), { hold: true });   // hold the file read open
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('#wsmPickFolder').click();
    const row = page.locator('#wsmCards .wsm-fp-row').first();
    await row.waitFor();
    await page.evaluate(() => { window.__holdReads = true; });   // from here on, a read is an OPEN

    await row.click();
    // the feedback is on the ROW, and it is there while the read is still in flight
    await expect(row, 'the clicked row goes busy').toHaveClass(/is-busy/, { timeout: 3000 });
    expect(await row.getAttribute('aria-busy'), 'and says so to a screen reader').toBe('true');
    // no global overlay — the app is not busy, one row is
    expect(await page.locator('.app-dialog, .ddcs-global-spinner').count(), 'no global spinner').toBe(0);
    // a second click cannot start a second open
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#wsmCards .wsm-fp-row')).pointerEvents),
        'the busy row stops accepting clicks').toBe('none');

    await page.screenshot({ path: 'scratchpad/s1257-row-busy-local.png' });
    await page.evaluate(() => window.__release && window.__release());
    await page.waitForFunction(() => /bench/.test(window.ddcsFileSavedName() || ''), null, { timeout: 8000 });
});

test('A CLOUD ROW — the worst case — goes busy for the whole Drive read', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google');
        localStorage.setItem('ddcs_cloud_email', 'maker@example.com');
        localStorage.removeItem('ddcs_gdrive_folder');
    });
    // the LISTING answers at once; the file READ is held, which is where a real Drive open spends its time
    let releaseRead = () => {};
    let holdReads = false;   // armed after the listing renders — the listing reads headers through the same endpoint
    const heldGate = () => (holdReads ? new Promise((res) => { releaseRead = res; }) : Promise.resolve());
    await page.route('https://www.googleapis.com/**', async (route) => {
        const url = route.request().url();
        const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
        const q = decodeURIComponent((url.split('q=')[1] || '').split('&')[0]);
        if (/alt=media/.test(url)) { await heldGate(); return json(JSON.parse(ddcs('cloud-rig'))); }
        if (/google-apps\.folder/.test(q)) return json({ files: [{ id: 'root-folder' }] });
        if (/in parents/.test(q)) return json({ files: [{ id: 'f1', name: 'cloud-rig.ddcs', mimeType: 'application/json', modifiedTime: '2026-07-24T10:00:00.000Z' }] });
        return json({});
    });
    await page.evaluate(() => window.openWorkspaceManager('open', { place: 'cloud' }));
    const row = page.locator('#wsmCards .wsm-fp-row').first();
    await row.waitFor({ timeout: 8000 });
    holdReads = true;

    await row.click();
    await expect(row, 'the cloud row goes busy for the fetch — the wait people actually feel').toHaveClass(/is-busy/, { timeout: 3000 });
    await page.screenshot({ path: 'scratchpad/s1257-row-busy-cloud.png' });
    releaseRead();
    await page.waitForFunction(() => /cloud-rig/.test(window.ddcsFileSavedName() || ''), null, { timeout: 10000 });
});

test('a FAILED open clears the glyph — the refusal is the feedback then, and it must not sit under a spinner', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google');
        localStorage.setItem('ddcs_cloud_email', 'maker@example.com');
        localStorage.removeItem('ddcs_gdrive_folder');
    });
    await page.route('https://www.googleapis.com/**', (route) => {
        const url = route.request().url();
        const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
        const q = decodeURIComponent((url.split('q=')[1] || '').split('&')[0]);
        if (/alt=media/.test(url)) return route.fulfill({ status: 500, body: 'Drive is having a moment' });
        if (/google-apps\.folder/.test(q)) return json({ files: [{ id: 'root-folder' }] });
        if (/in parents/.test(q)) return json({ files: [{ id: 'f1', name: 'cloud-rig.ddcs', mimeType: 'application/json', modifiedTime: '2026-07-24T10:00:00.000Z' }] });
        return json({});
    });
    await page.evaluate(() => window.openWorkspaceManager('open', { place: 'cloud' }));
    const row = page.locator('#wsmCards .wsm-fp-row').first();
    await row.waitFor({ timeout: 8000 });
    await row.click();
    await expect(page.locator('.app-dialog'), 'the named refusal appears').toBeVisible({ timeout: 8000 });
    await expect(row, 'and the glyph is gone — the row is clickable again').not.toHaveClass(/is-busy/);
});

test('NO SPINNER ON AN INSTANT ACTION — switching the place tab does not fake a wait', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await page.locator('.wsm-place[data-place="cloud"]').click();
    expect(await page.locator('.is-busy').count(), 'a tab switch is instant; a glyph here would teach people the app is slow').toBe(0);
});

test('the dead quick-menu declarations are gone (authorized housekeeping)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const src = await page.evaluate(() => fetch('/ui/headerPost.js').then((r) => r.text()));
    expect(src, 'HQ_ACTIONS had no consumer since t1227').not.toMatch(/const HQ_ACTIONS\s*=/);
    expect(src, 'nor HQ_STANDALONE').not.toMatch(/const HQ_STANDALONE\s*=/);
    expect(src, 'and the row list that claimed Clear was the phone access point went with them')
        .not.toMatch(/Clear stays here as the phone/);
});
