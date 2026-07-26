import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';   // t684 d — in-app dialog

/**
 * WORKSPACE E3 — USER FILE ORGANIZATION (t664). The user can ADD / RENAME / DELETE their own files in the Macros tab;
 * they live in settings.workspaceFiles (list) + settings.workspace (body) so they ride the profile (snapshot / full-swap
 * / export-import / cloud). The declared BASELINE tree is IMMUTABLE — baseline files offer Revert-to-default, never
 * rename/delete. User files render under a "My files/" group, visually distinct.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const openMacros = async (page, fresh = true) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => typeof window.showApp === 'function' && window.ddcsSetMachine && window.ddcsGetSettings);
    if (fresh) await page.evaluate(() => localStorage.removeItem('ddcs_profile_library'));
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForFunction(() => document.querySelector('#macros_tree .settings-tab'));
};
// t1217 — retargeting the workspace's controller is setMachine (was profileLibrary.setActiveControllerId)
const setController = (page, id) => page.evaluate((cid) => window.ddcsSetMachine({ controllerId: cid }, true), id);
const clickTreeFile = (page, name) => page.evaluate((f) => [...document.querySelectorAll('#macros_tree .settings-tab')].find((b) => b.dataset.file === f)?.click(), name);
const myFiles = (page) => page.evaluate(() => {
    const grp = [...document.querySelectorAll('#macros_tree details')].find((d) => /My files/.test(d.querySelector('summary')?.textContent || ''));
    return grp ? [...grp.querySelectorAll('.settings-tab')].map((b) => b.dataset.file) : [];
});

test('add → edit → reload persists (under My files, push present) → rename → delete', async ({ page }) => {
    await openMacros(page);
    await setController(page, 'ddcs-v41');
    await page.waitForFunction(() => document.getElementById('mac_add_file'));
    // ADD a file (prompt) → the editor opens for it
    await autoAppDialog(page, { accept: true, prompt: 'myprobe.nc' });
    await page.click('#mac_add_file');
    await page.waitForFunction(() => document.getElementById('macfile_body'));
    // EDIT it
    await page.evaluate(() => { const ta = document.getElementById('macfile_body'); ta.value = 'G0 X5 ( MINE )'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(await myFiles(page), 'the new file shows under "My files/"').toContain('myprobe.nc');
    expect(await page.evaluate(() => window.ddcsGetSettings().workspaceFiles.map((f) => f.path)), 'recorded in workspaceFiles').toContain('myprobe.nc');
    expect(await page.evaluate(() => window.ddcsGetSettings().workspace['myprobe.nc']), 'body stored in workspace').toBe('G0 X5 ( MINE )');

    // RELOAD → the user file + its body persist (in the profile)
    await openMacros(page, false);   // keep the library (test persistence)
    expect(await myFiles(page), 'the user file survives reload').toContain('myprobe.nc');
    await clickTreeFile(page, 'myprobe.nc');
    await page.waitForFunction(() => document.getElementById('macfile_body'));
    const after = await page.evaluate(() => ({ body: document.getElementById('macfile_body').value, send: document.getElementById('macfile_send').textContent, rename: !!document.getElementById('macfile_rename'), del: !!document.getElementById('macfile_delete') }));
    expect(after.body, 'the edited body survives reload').toBe('G0 X5 ( MINE )');
    expect(after.send, 'a user file on V4.1 pushes over LAN').toContain('Push');
    expect(after.rename && after.del, 'a user file offers Rename + Delete').toBe(true);

    // RENAME → the body carries; the old name is gone
    await autoAppDialog(page, { accept: true, prompt: 'renamed.nc' });
    await page.click('#macfile_rename');
    await page.waitForFunction(() => [...document.querySelectorAll('#macros_tree .settings-tab')].some((b) => b.dataset.file === 'renamed.nc'));
    expect(await myFiles(page), 'renamed').toEqual(['renamed.nc']);
    expect(await page.evaluate(() => window.ddcsGetSettings().workspace['renamed.nc']), 'body carried to the new name').toBe('G0 X5 ( MINE )');
    expect(await page.evaluate(() => window.ddcsGetSettings().workspace['myprobe.nc']), 'old name body cleared').toBeUndefined();

    // DELETE → gone from the profile
    await clickTreeFile(page, 'renamed.nc');
    await page.waitForFunction(() => document.getElementById('macfile_delete'));
    await autoAppDialog(page, { accept: true });
    await page.click('#macfile_delete');
    await page.waitForFunction(() => ![...document.querySelectorAll('#macros_tree .settings-tab')].some((b) => b.dataset.file === 'renamed.nc'));
    expect(await page.evaluate(() => window.ddcsGetSettings().workspaceFiles.length), 'deleted from the profile').toBe(0);
    expect(await page.evaluate(() => window.ddcsGetSettings().workspace['renamed.nc']), 'body removed').toBeUndefined();
});

// t1217 — the "profile switch SWAPS user files" third of this test is RETIRED with the profile library
// ([[one-workspace-one-machine]]): one workspace = one machine, so there is no switch. The IMPORT half survives and
// gets MORE important, because importing a machine bundle now APPLIES it to this workspace (it used to mint a new
// library entry) — so this is the test that pins the new landing.
test('baseline files are IMMUTABLE (Revert-to-default, never rename/delete); an imported bundle carries user files INTO this workspace', async ({ page }) => {
    await openMacros(page);
    await setController(page, 'ddcs-v41');
    // a BASELINE file → Revert-to-default, NO rename/delete
    await clickTreeFile(page, 'probe-fix.nc');
    await page.waitForFunction(() => document.getElementById('macfile_body'));
    const baseline = await page.evaluate(() => ({ revert: !!document.getElementById('macfile_revert'), rename: !!document.getElementById('macfile_rename'), del: !!document.getElementById('macfile_delete') }));
    expect(baseline.revert, 'baseline file offers Revert-to-default').toBe(true);
    expect(baseline.rename || baseline.del, 'baseline file is NOT renamable/deletable (immutable structure)').toBe(false);

    // this workspace has a user file of its own
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.workspaceFiles = [{ path: 'mine.nc', title: 'mine.nc', sub: 'Your file' }]; s.workspace['mine.nc'] = 'G0 Z1';
    });

    // IMPORT — a bundle carrying workspaceFiles is APPLIED to THIS workspace (t1217; export is symmetric:
    // buildProfile.settings = getSettings). It also adopts the bundle's identity, since the file IS the machine.
    const imported = await page.evaluate(async () => {
        const store = await import('/data/profileStore.js');
        store.landImportedProfile({
            name: 'Imported', controllerId: 'ddcs-v41',
            settings: { workspaceFiles: [{ path: 'fromimport.nc', title: 'fromimport.nc', sub: 'Your file' }], workspace: { 'fromimport.nc': 'G0 Y2' } },
            userVars: [],
        });
        const s = window.ddcsGetSettings();
        return { files: s.workspaceFiles.map((f) => f.path), body: s.workspace['fromimport.nc'], machine: window.ddcsGetMachine() };
    });
    expect(imported.files, 'an imported bundle carries its user files into this workspace').toContain('fromimport.nc');
    expect(imported.body, 'and their bodies').toBe('G0 Y2');
    // FULL SWAP, not a merge — this workspace's own user file is GONE, because it now IS the imported machine
    expect(imported.files, 'the previous machine\'s user file did NOT survive the import (a swap, not a blend)').not.toContain('mine.nc');
    expect(imported.machine.name, 'and the workspace identifies as the imported machine').toBe('Imported');
});
