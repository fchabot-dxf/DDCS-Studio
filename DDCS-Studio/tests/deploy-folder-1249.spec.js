import { test, expect } from '@playwright/test';

/**
 * t1249 — THE DEPLOY TARGET. The third and last folder, and the one that closes the ownership model:
 *
 *   WORKSPACES  where THIS machine's .ddcs lives             — the workspace IS the machine
 *   LIBRARY     where shareable SOURCES live (.wiz / .cam)   — things you hand to a person
 *   DEPLOY      where BAKED OUTPUT goes                      — things the CONTROLLER eats
 *
 * The headline case is granting the USB STICK ITSELF, so a deploy writes straight onto the medium that walks to the
 * machine. That is the point of every assertion here: a download lands in Downloads, and then a human has to find it,
 * copy it to a stick, and remember which of four similarly-named files was the current one. Granting the stick makes
 * the export BE the copy.
 *
 * THE RULES, each with a test: no downloads when a folder is granted; a DECLINED picker writes nothing and downloads
 * nothing (a refusal is an answer, not a problem to route around); only the deploy's own files are written; a write
 * failure is named, not swallowed; and the CAM bundle's bytes are the SAME bytes the download produced.
 */
// The suite's own server. DDCS_BASE exists only so a second agent can run this against a private mem-server while
// someone else's full suite holds 3211 — the DEFAULT must be the shared one, or the spec passes for me and nobody else.
const BASE = process.env.DDCS_BASE || 'http://localhost:3211';
test.use({ viewport: { width: 1280, height: 900 } });

/** A fake granted folder that records every write, including the subdirectories a name declares. */
async function grantDeploy(page, { readOnly = false } = {}) {
    await page.evaluate((ro) => {
        const files = window.__deploy = new Map();
        const mkDir = (prefix) => ({
            kind: 'directory', name: prefix ? prefix.replace(/\/$/, '') : 'USB STICK',
            queryPermission: async () => 'granted', requestPermission: async () => 'granted',
            getDirectoryHandle: async (n) => mkDir(prefix + n + '/'),
            getFileHandle: async (n) => ({
                kind: 'file', name: n,
                createWritable: async () => {
                    if (ro) throw new Error('The disk is write-protected');
                    return { write: async (d) => files.set(prefix + n, d), close: async () => {} };
                },
            }),
            async *entries() { for (const k of [...files.keys()]) if (!k.includes('/')) yield [k, { kind: 'file', name: k }]; },
        });
        window.__deployPicks = 0;
        window.showDirectoryPicker = async () => { window.__deployPicks++; return mkDir(''); };
    }, readOnly);
}

const boot = async (page) => {
    await page.goto(BASE);
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
};
const deployed = (page) => page.evaluate(() => [...window.__deploy.keys()].sort());

test('A PROGRAM EXPORT IS A DEPLOY: it lands in the granted folder, and nothing downloads', async ({ page }) => {
    await boot(page);
    await grantDeploy(page);
    let downloads = 0;
    page.on('download', () => { downloads++; });

    await page.evaluate(() => { window.ddcsStudio.editorManager.setValue('G0 X10 Y10\nG1 Z-2 F100\nM30'); });
    const r = await page.evaluate(() => window.ddcsStudio.editorManager.downloadFile());
    expect(r.written.length, 'one file written').toBe(1);
    expect(r.written[0], 'named after the program').toMatch(/\.nc$/);
    expect(await deployed(page), 'and it really is in the folder').toEqual(r.written);
    const body = await page.evaluate((n) => window.__deploy.get(n), r.written[0]);
    expect(body, 'carrying the program, not a stub').toContain('G1 Z-2 F100');
    expect(downloads, 'NO download fired — a granted folder means the export IS the copy').toBe(0);
});

test('THE CAM BUNDLE deploys the SAME FILE SET the download produced — byte for byte', async ({ page }) => {
    await boot(page);
    await grantDeploy(page);
    let downloads = 0;
    page.on('download', () => { downloads++; });

    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        const mv = { type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } };
        U.createUserOp(U.userOpFromStack('deploy_op', 'Deploy Op', [mv], U.extractParamBlocks([mv])));
        localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 'Shop pack', baseSlot: 22 }, slots: [
            { slot: 22, name: 'Slot A', ops: [{ type: 'universal', variant: '', values: {}, exposed: {}, baked: {}, opType: 'user_deploy_op', defV: 1 }] },
        ] }));
        (await import('/ui/macrosApp.js')).initMacrosApp();
    });
    await page.waitForFunction(() => window.showApp);
    await page.evaluate(() => window.showApp('macros'));
    await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
    await page.waitForSelector('#cam_slots .cam-slot', { timeout: 10000 });

    // THE EXPECTED SET, computed from the same declared sources the exporter reads — so this asserts the bytes, not
    // "some files appeared". If the exporter ever stops emitting one, the comparison says which.
    const expected = await page.evaluate(async () => {
        const sp = await import('/data/slotPack.js');
        const pack = JSON.parse(localStorage.getItem('ddcs_campack'));
        const out = {};
        pack.slots.forEach((s) => { out[`CAM/macro_cam${s.slot}.nc`] = sp.slotMacro(s); });
        return out;
    });

    await page.click('#cam_export_pack');
    await page.waitForFunction(() => window.__deploy && window.__deploy.size > 0, null, { timeout: 10000 });
    const names = await deployed(page);
    expect(names, 'the macro, the eng lines to merge, and the install README — the whole bundle').toEqual(
        expect.arrayContaining(['CAM/macro_cam22.nc', 'eng-additions.txt', 'README.txt']));
    for (const [n, body] of Object.entries(expected)) {
        expect(await page.evaluate((k) => window.__deploy.get(k), n), `${n} is byte-identical to what the download carried`).toBe(body);
    }
    expect(downloads, 'and no .zip fell into Downloads').toBe(0);
    // the stick wants CAM/ sitting on it — step 3 of the README is "cursor on the CAM folder"
    expect(names.some((n) => n.startsWith('CAM/')), 'written as a real folder tree, not a zip to unpack').toBe(true);
});

test('A DECLINED PICKER WRITES NOTHING AND DOWNLOADS NOTHING — a refusal is an answer', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { window.showDirectoryPicker = async () => { throw new Error('user declined'); }; });
    let downloads = 0;
    page.on('download', () => { downloads++; });

    await page.evaluate(() => { window.ddcsStudio.editorManager.setValue('G0 X1\nM30'); });
    const r = await page.evaluate(() => window.ddcsStudio.editorManager.downloadFile());
    expect(r.aborted, 'the deploy aborted').toBe(true);
    expect(r.written, 'nothing written').toEqual([]);
    expect(downloads, 'and CRUCIALLY no download — turning a refusal into a surprise file is the app overruling the user').toBe(0);
    await expect(page.locator('.app-dialog'), 'no announcement of a thing that did not happen').toHaveCount(0);
});

test('A WRITE FAILURE IS NAMED — a write-protected stick says so, in the words the OS used', async ({ page }) => {
    await boot(page);
    await grantDeploy(page, { readOnly: true });
    const r = await page.evaluate(async () => {
        const D = await import('/data/deployFolder.js');
        const res = await D.deployFiles([{ name: 'prog.nc', data: 'G0 X0' }]);
        return { res, msg: D.deployedMessage(res) };
    });
    expect(r.res.ok, 'the deploy did not succeed').toBe(false);
    expect(r.res.failed[0].name).toBe('prog.nc');
    expect(r.res.failed[0].why, 'the reason the OS gave, not a generic failure').toMatch(/write-protected/i);
    expect(r.msg, 'and the message repeats it rather than swallowing it').toMatch(/write-protected/i);
});

test('THE WORD IS DEPLOYED, NEVER SAVED — and it names the files and the folder', async ({ page }) => {
    await boot(page);
    await grantDeploy(page);
    const msg = await page.evaluate(async () => {
        const D = await import('/data/deployFolder.js');
        const r = await D.deployFiles([{ name: 'a.nc', data: 'x' }, { name: 'CAM/b.nc', data: 'y' }]);
        return D.deployedMessage(r);
    });
    expect(msg, 'says deployed').toMatch(/^Deployed 2 files to /);
    expect(msg, 'names the folder').toMatch(/USB STICK/);
    expect(msg, 'and the files').toMatch(/a\.nc/);
    expect(msg.toLowerCase(), 'never “saved” — saving is what you do to YOUR workspace; a deploy is a copy for a machine')
        .not.toMatch(/\bsaved?\b/);
});

test('RE-PICK REDIRECTS THE NEXT WRITE — and the picker really reopens', async ({ page }) => {
    await boot(page);
    await grantDeploy(page);
    const r = await page.evaluate(async () => {
        const D = await import('/data/deployFolder.js');
        await D.deployFiles([{ name: 'first.nc', data: '1' }]);
        const picksAfterFirst = window.__deployPicks;
        // a second deploy REUSES the target — the folder is asked for once
        await D.deployFiles([{ name: 'second.nc', data: '2' }]);
        const picksAfterSecond = window.__deployPicks;
        // …and Change… forces a fresh pick
        await D.ensureDeployFolder({ repick: true });
        const picksAfterRepick = window.__deployPicks;
        await D.deployFiles([{ name: 'third.nc', data: '3' }]);
        return { picksAfterFirst, picksAfterSecond, picksAfterRepick, files: [...window.__deploy.keys()].sort() };
    });
    expect(r.picksAfterFirst, 'asked once, on the first deploy').toBe(1);
    expect(r.picksAfterSecond, 'and not again — a target is remembered').toBe(1);
    expect(r.picksAfterRepick, 'Change… reopens the picker, or the button would look broken').toBe(2);
    expect(r.files, 'every deploy landed').toEqual(['first.nc', 'second.nc', 'third.nc']);
});

test('SOURCES ARE NOT DEPLOYS — the .wiz / .cam / .ddcs folders are untouched by a deploy', async ({ page }) => {
    await boot(page);
    await grantDeploy(page);
    const r = await page.evaluate(async () => {
        const D = await import('/data/deployFolder.js');
        const L = await import('/data/libraryFolder.js');
        const F = await import('/data/fsHandles.js');
        await D.deployFiles([{ name: 'prog.nc', data: 'G0' }]);
        return {
            deployKey: D.DEPLOY_KEY, libKey: L.LIBRARY_KEY, wsKey: F.FOLDER_KEY,
            libAfter: (await L.listLibrary()).length,
            deployed: [...window.__deploy.keys()],
        };
    });
    expect(new Set([r.deployKey, r.libKey, r.wsKey]).size, 'three DISTINCT remembered folders, not one shared').toBe(3);
    expect(r.libAfter, 'the library folder was not written to, or even adopted, by a deploy').toBe(0);
    expect(r.deployed, 'only the deploy’s own file').toEqual(['prog.nc']);
});

test('THE GATEWAY FILES SURFACE STATES THE TARGET, and offers the re-pick', async ({ page }) => {
    await boot(page);
    await grantDeploy(page);
    // showApp is set LATE in boot (gatewayStatus, IIFE step 5) — wait for the real signal, not the page load
    await page.waitForFunction(() => typeof window.showApp === 'function', null, { timeout: 15000 });
    await page.evaluate(() => window.showApp('gateway'));
    // the Files view is one of the Gateway's tabs; select it, then the target row is there
    await page.click('text=Files (CNCDISK)').catch(() => {});
    await page.waitForSelector('#gw_deploy_target', { timeout: 10000 });
    await expect(page.locator('#gw_deploy_target')).toContainText(/DEPLOY TARGET/);
    await expect(page.locator('#gw_deploy_target'), 'with no target yet it says what one is for').toContainText(/USB stick|not chosen/i);
    await page.click('#gw_deploy_pick');
    await expect(page.locator('#gw_deploy_target'), 'and after choosing, it names the folder').toContainText(/USB STICK/, { timeout: 8000 });
});
