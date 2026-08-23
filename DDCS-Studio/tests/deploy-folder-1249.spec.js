import { test, expect } from '@playwright/test';

/**
 * t1249 — THE DEPLOY TARGET. The third and last folder, and the one that closes the ownership model:
 *
 *   WORKSPACES  where THIS machine's .ddcs lives             — the workspace IS the machine
 *   LIBRARY     where shareable SOURCES live (.wiz / .cam)   — things you hand to a person
 *   DEPLOY      where BAKED OUTPUT goes                      — things the CONTROLLER eats
 *
 * The headline case is granting the USB STICK ITSELF, so a deploy writes straight onto the medium that walks to the
 * machine. That is the point of most assertions here: a download lands in Downloads, and then a human has to find it,
 * copy it to a stick, and remember which of four similarly-named files was the current one. Granting the stick makes
 * the export BE the copy. STILL TRUE for the CAM bundle, a probe macro's T.nc, and the Gateway Files surface.
 *
 * t2178 (human ruling: "export should simply be a ffile browser with a native save file") — THE PROGRAM EXPORT
 * ITSELF NO LONGER USES THIS MECHANISM. `editorManager.downloadFile()` now opens the OS's own native save-file
 * dialog (`showSaveFilePicker`) instead of writing into a granted DIRECTORY; the two tests that used to drive it
 * through the directory-picker mock are rewritten below to drive the new one instead. `deployFolder.js` itself,
 * and every OTHER caller of `deployFiles()` (the CAM bundle, the probe macro, Gateway Files), are UNCHANGED —
 * this was a scoped change to Export specifically, not a removal of the deploy mechanism.
 *
 * THE RULES for what's left, each with a test: no downloads when a folder is granted; a DECLINED picker writes
 * nothing and downloads nothing (a refusal is an answer, not a problem to route around); only the deploy's own
 * files are written; a write failure is named, not swallowed; and the CAM bundle's bytes are the SAME bytes the
 * download produced.
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

/** A fake native save-file picker (t2178) — records the ONE write it grants a handle for. */
async function grantSaveFilePicker(page, { writeError = null } = {}) {
    await page.evaluate((err) => {
        window.__saved = new Map();
        window.__saveFilePickerCalls = 0;
        window.showSaveFilePicker = async (opts) => {
            window.__saveFilePickerCalls++;
            const name = opts && opts.suggestedName;
            return {
                createWritable: async () => {
                    if (err) throw new Error(err);
                    return { write: async (d) => window.__saved.set(name, d), close: async () => {} };
                },
            };
        };
    }, writeError);
}

test('EXPORT USES THE NATIVE SAVE DIALOG (t2178): the operator\'s own pick gets the file, nothing downloads', async ({ page }) => {
    await boot(page);
    await grantSaveFilePicker(page);
    let downloads = 0;
    page.on('download', () => { downloads++; });

    await page.evaluate(() => { window.ddcsStudio.editorManager.setValue('G0 X10 Y10\nG1 Z-2 F100\nM30'); });
    const r = await page.evaluate(() => window.ddcsStudio.editorManager.downloadFile());
    expect(r.written.length, 'one file written').toBe(1);
    expect(r.written[0], 'named after the program').toMatch(/\.nc$/);
    const saved = await page.evaluate(() => [...window.__saved.keys()]);
    expect(saved, 'and it really went through the native picker\'s own handle').toEqual(r.written);
    const body = await page.evaluate((n) => window.__saved.get(n), r.written[0]);
    expect(body, 'carrying the program, not a stub').toContain('G1 Z-2 F100');
    expect(downloads, 'NO plain download fired — the native dialog IS the save, not a fallback path').toBe(0);
});

test('EXPORT WITHOUT File System Access: the SAME action degrades to a plain download, not a second behaviour', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { delete window.showSaveFilePicker; });
    let downloadedFile = null;
    page.on('download', (d) => { downloadedFile = d.suggestedFilename(); });

    await page.evaluate(() => { window.ddcsStudio.editorManager.setValue('G0 X1\nM30'); });
    const r = await page.evaluate(() => window.ddcsStudio.editorManager.downloadFile());
    expect(r.viaDownload, 'no native picker on this browser — the fallback path').toBe(true);
    expect(r.written.length).toBe(1);
    await page.waitForTimeout(200);
    expect(downloadedFile, 'the SAME file the native path would have saved, just via a plain download').toBe(r.written[0]);
});

test('A WRITE FAILURE via the native dialog is NAMED, not swallowed', async ({ page }) => {
    await boot(page);
    await grantSaveFilePicker(page, { writeError: 'The disk is write-protected' });
    await page.evaluate(() => { window.ddcsStudio.editorManager.setValue('G0 X1\nM30'); });
    const r = await page.evaluate(() => window.ddcsStudio.editorManager.downloadFile());
    expect(r.ok, 'the export did not succeed').toBe(false);
    expect(r.failed[0].why, 'the reason, not a generic failure').toMatch(/write-protected/i);
    await expect(page.locator('.app-dialog'), 'the failure is announced, not silent').toBeVisible();
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
            // t2117 -- an icon on the fixture slot so this test still exercises SUBDIRECTORY writing
            // (install/CAM/, per T3) now that the macro itself moved to the flat root as cam22.nc.
            { slot: 22, name: 'Slot A', icon: { data: 'data:image/bmp;base64,dGVzdA==' },
              ops: [{ type: 'universal', variant: '', values: {}, exposed: {}, baked: {}, opType: 'user_deploy_op', defV: 1 }] },
        ] }));
        (await import('/ui/macrosApp.js')).initMacrosApp();
    });
    await page.waitForFunction(() => window.showApp);
    await page.evaluate(() => window.showApp('macros'));
    await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
    await page.waitForSelector('#cam_slots .cam-slot', { timeout: 10000 });

    // THE EXPECTED SET, computed from the same declared sources the exporter reads — so this asserts the bytes, not
    // "some files appeared". If the exporter ever stops emitting one, the comparison says which.
    // t2117 -- cam<N>.nc at the ROOT, not CAM/macro_cam<N>.nc: the vendor's own dispatcher parameter (#968) looks
    // for cam<N>.nc at the controller's /local root, confirmed against THIS machine's own live SYSDISK/eng
    // (VENDOR-PACK-FIXES-PLAN.md T3/T4).
    const expected = await page.evaluate(async () => {
        const sp = await import('/data/slotPack.js');
        const pack = JSON.parse(localStorage.getItem('ddcs_campack'));
        const out = {};
        pack.slots.forEach((s) => { out[`cam${s.slot}.nc`] = sp.slotMacro(s); });
        return out;
    });

    await page.click('#cam_export_pack');
    await page.waitForFunction(() => window.__deploy && window.__deploy.size > 0, null, { timeout: 10000 });
    const names = await deployed(page);
    expect(names, 'the macro, the icon, the eng/chs lines to merge, and the install README — the whole bundle').toEqual(
        expect.arrayContaining(['cam22.nc', 'install/CAM/cam22.bmp', 'eng-additions.txt', 'chs-additions.txt', 'README.txt']));
    for (const [n, body] of Object.entries(expected)) {
        expect(await page.evaluate((k) => window.__deploy.get(k), n), `${n} is byte-identical to what the download carried`).toBe(body);
    }
    expect(downloads, 'and no .zip fell into Downloads').toBe(0);
    // t2118 -- dropped a redundant assertion here: line 108's arrayContaining already names the literal
    // 'install/CAM/cam22.bmp', which alone proves the subdirectory write; a separate startsWith check on the
    // same fact added no coverage.
});

test('A DECLINED EXPORT PICKER WRITES NOTHING AND DOWNLOADS NOTHING — a refusal is an answer', async ({ page }) => {
    await boot(page);
    // showSaveFilePicker rejects with a real DOMException-shaped AbortError when the operator cancels the
    // native dialog — the exact shape editorManager.downloadFile() checks for (e.name === 'AbortError').
    await page.evaluate(() => {
        window.showSaveFilePicker = async () => { const e = new Error('The user aborted a request.'); e.name = 'AbortError'; throw e; };
    });
    let downloads = 0;
    page.on('download', () => { downloads++; });

    await page.evaluate(() => { window.ddcsStudio.editorManager.setValue('G0 X1\nM30'); });
    const r = await page.evaluate(() => window.ddcsStudio.editorManager.downloadFile());
    expect(r.aborted, 'the export aborted').toBe(true);
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
