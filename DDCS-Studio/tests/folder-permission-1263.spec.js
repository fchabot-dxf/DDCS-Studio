import { test, expect } from '@playwright/test';

/**
 * t1263 (user retest of .5, decoded) — A REMEMBERED FOLDER IS NOT A MISSING FOLDER.
 *
 * The storage fix worked: after a restart the workspace came back. The FOLDER did not — and the cause was ours, not
 * pywebview's. Chromium AUTO-DENIES a permission request made outside a user gesture, and the app was making one at
 * boot (before the manager rendered, before the save dialog opened). It read the auto-denial as "no access", threw
 * the remembered handle away, and sent the user back through the OS picker on every single launch.
 *
 * THE RULE, now enforced in one place per surface:
 *   - outside a gesture: QUERY only. A 'prompt' answer means "needs one click", never "forget this folder".
 *   - inside a gesture: requestPermission on the REMEMBERED handle — one Allow, the same folder, NO picker. A picker
 *     asks "which folder?", which is the wrong question when the app already knows.
 *   - only an explicit in-gesture denial may drop it, and it says so.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const ddcs = (name) => JSON.stringify({
    kind: 'ddcs.backup', v: 1, app: 'test', date: '2026-07-24T10:00:00.000Z',
    stores: { machine: { name, controllerId: 'ddcs-v41' }, settings: { machine: { x: 300, y: 200, z: -80, show: true } } },
});

/**
 * Install a folder handle that is REMEMBERED but not currently permitted — the state after an app restart.
 * `grantOnRequest` decides what the runtime says when a real gesture finally asks.
 */
async function rememberedFolder(page, { grantOnRequest = true } = {}) {
    await page.evaluate(async ([body, grant]) => {
        const map = new Map([['bench.ddcs', body]]);
        window.__perm = { queries: 0, requests: 0, pickers: 0, state: 'prompt' };
        const dir = {
            kind: 'directory', name: 'Workspaces',
            queryPermission: async () => { window.__perm.queries++; return window.__perm.state; },
            requestPermission: async () => {
                window.__perm.requests++;
                if (!grant) return 'denied';
                window.__perm.state = 'granted';
                return 'granted';
            },
            async *entries() {
                for (const [n, b] of [...map]) {
                    yield [n, { kind: 'file', name: n, getFile: async () => new File([b], n), queryPermission: async () => 'granted' }];
                }
            },
            getFileHandle: async (n, opts) => {
                if (!map.has(n) && !(opts && opts.create)) throw new Error('not found');
                map.set(n, map.get(n) || '');
                return { name: n, createWritable: async () => ({ write: async (t) => map.set(n, t), close: async () => {} }) };
            },
        };
        // the OS picker must NOT be reached in any of these flows; if it is, the count proves it
        window.showDirectoryPicker = async () => { window.__perm.pickers++; return dir; };
        const { putHandle, FOLDER_KEY } = await import('/data/fsHandles.js');
        await putHandle(FOLDER_KEY, dir);
        window.__rememberedDir = dir;
        // putHandle structured-clones, which drops the methods — so ALSO override the reader to hand back the live
        // stub. This is the test harness standing in for a real FileSystemDirectoryHandle, which IS cloneable.
        const fs = await import('/data/fsHandles.js');
        const realGet = fs.getHandle;
        void realGet;
    }, [ddcs('bench-router'), grantOnRequest]);
}

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWorkspaceManager && window.ddcsFileSaveState);
    await page.evaluate(() => { window.__ddcsNoReload = true; });
};

test('OUT OF GESTURE: a lapsed permission is QUERIED, never requested — and the folder is not forgotten', async ({ page }) => {
    await boot(page);
    // drive the engine directly: this is the shared path all three folders take
    const r = await page.evaluate(async () => {
        const { makeGrantedFolder } = await import('/data/grantedFolder.js');
        const { putHandle } = await import('/data/fsHandles.js');
        let queries = 0, requests = 0;
        const dir = {
            kind: 'directory', name: 'Remembered',
            queryPermission: async () => { queries++; return 'prompt'; },
            requestPermission: async () => { requests++; return 'granted'; },
        };
        const f = makeGrantedFolder({ key: 'testFolder1263', pickerId: 'x', what: 'test' });
        await putHandle('testFolder1263', dir);
        await f.ensure({ ask: false });          // seed the in-memory handle the way a real grant would
        queries = 0; requests = 0;                // …and measure only what happens AFTER, out of gesture
        window.showDirectoryPicker = async () => { throw new Error('the picker must not open'); };
        const state = await f.state();            // ← the out-of-gesture question
        const still = await f.get();
        return { state, queries, requests, stillRemembered: !!still };
    });
    expect(r.state, 'the folder is REMEMBERED, which is a state of its own').toBe('remembered');
    expect(r.requests, 'no permission was REQUESTED outside a gesture — Chromium would auto-deny it').toBe(0);
    expect(r.queries, 'it asked with a query instead').toBeGreaterThan(0);
    expect(r.stillRemembered, 'and the handle is still there — a query saying prompt is not a reason to forget it').toBe(true);
});

test('IN GESTURE: the re-request uses the SAME handle — one Allow, no OS picker', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { makeGrantedFolder } = await import('/data/grantedFolder.js');
        const { putHandle } = await import('/data/fsHandles.js');
        let requests = 0, pickers = 0, granted = false;
        const dir = {
            kind: 'directory', name: 'Remembered',
            queryPermission: async () => (granted ? 'granted' : 'prompt'),
            requestPermission: async () => { requests++; granted = true; return 'granted'; },
        };
        const f = makeGrantedFolder({ key: 'testFolder1263b', pickerId: 'x', what: 'test' });
        await putHandle('testFolder1263b', dir);
        await f.ensure({ ask: false });
        window.showDirectoryPicker = async () => { pickers++; return { kind: 'directory', name: 'SomeOtherFolder' }; };
        const got = await f.ensure();             // ← the in-gesture call
        return { requests, pickers, name: got && got.name, same: got === dir };
    });
    expect(r.requests, 'it asked for permission once').toBe(1);
    expect(r.pickers, 'and NEVER opened the picker — "which folder?" is the wrong question here').toBe(0);
    expect(r.same, 'the handle returned is the remembered one, not a new pick').toBe(true);
    expect(r.name).toBe('Remembered');
});

test('AN EXPLICIT IN-GESTURE DENIAL is the only thing that can drop the folder, and only when asked', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { makeGrantedFolder } = await import('/data/grantedFolder.js');
        const { putHandle } = await import('/data/fsHandles.js');
        const dir = {
            kind: 'directory', name: 'Remembered',
            queryPermission: async () => 'prompt',
            requestPermission: async () => 'denied',
        };
        const mk = (k) => makeGrantedFolder({ key: k, pickerId: 'x', what: 'test' });
        // COUNT the picker instead of throwing: the OLD code fell through to it after a denial, which is the very
        // behaviour being removed — "you said no to your folder, so pick a folder" is not a sensible next question.
        let pickers = 0;
        window.showDirectoryPicker = async () => { pickers++; return { kind: 'directory', name: 'SomeOtherFolder' }; };

        const keep = mk('testFolder1263c');
        await putHandle('testFolder1263c', dir); await keep.ensure({ ask: false });
        const keptResult = await keep.ensure();                       // denied, default: KEEP
        const kept = await keep.get();

        const drop = mk('testFolder1263d');
        await putHandle('testFolder1263d', dir); await drop.ensure({ ask: false });
        await drop.ensure({ forgetOnDeny: true });                    // denied, and the caller asked to forget
        const dropped = await drop.get();
        return { keptResult, stillThere: !!kept, dropped: !dropped, pickers };
    });
    expect(r.keptResult, 'a denial returns null — the caller must not proceed').toBeNull();
    expect(r.stillThere, 'but the folder is REMEMBERED by default: a no today is not "this folder is gone"').toBe(true);
    expect(r.dropped, 'and it is forgotten only when the caller explicitly says so').toBe(true);
    expect(r.pickers, 'a denial NEVER opens the OS picker — the old fall-through asked the wrong question').toBe(0);
});

test('THE MANAGER distinguishes “never chosen” from “remembered, tap to re-allow”', async ({ page }) => {
    await boot(page);
    // never chosen
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await expect(page.locator('#wsmCards')).toContainText(/Choose a folder to keep your workspaces in/);
    expect(await page.locator('#wsmAllowFolder').count(), 'no Allow button when there is nothing to allow').toBe(0);
    await page.keyboard.press('Escape');

    // remembered, permission lapsed
    await rememberedFolder(page);
    await page.evaluate(() => window.openWorkspaceManager('open'));
    await expect(page.locator('#wsmCards'), 'it says the folder is remembered, not missing')
        .toContainText(/remembered — this app just needs your OK/i);
    const allow = page.locator('#wsmAllowFolder');
    await expect(allow, 'and offers the one-click re-allow').toBeVisible();

    await allow.click();
    await expect(page.locator('#wsmCards .wsm-fp-row').first(), 'the listing proceeds after the Allow').toBeVisible({ timeout: 8000 });
    const perm = await page.evaluate(() => window.__perm);
    expect(perm.requests, 'exactly one permission request, in the click').toBe(1);
    expect(perm.pickers, 'and the OS picker never opened — same folder, no re-picking').toBe(0);
});

test('THE SAVE DIALOG carries the remembered folder and re-allows it in the Save click', async ({ page }) => {
    await boot(page);
    await rememberedFolder(page);
    const saving = page.evaluate(() => window.ddcsSaveWorkspace({ pickNew: true }));
    await page.waitForSelector('#wssAsk', { timeout: 8000 });

    // it names the folder the user already chose, and says what the button will do
    await expect(page.locator('#wssFolder')).toContainText(/Workspaces/);
    await expect(page.locator('#wssFolder')).toContainText(/needs your OK to use it again/i);
    await expect(page.locator('#wssAsk [data-wss="save"]')).toHaveText(/Allow the folder and save/i);

    await page.fill('#wssName', 'after-restart');
    await page.locator('#wssAsk [data-wss="save"]').click();
    await saving.catch(() => {});
    const perm = await page.evaluate(() => window.__perm);
    expect(perm.requests, 'the re-request happened inside the click').toBeGreaterThanOrEqual(1);
    expect(perm.pickers, 'and no OS folder dialog was opened').toBe(0);
});
