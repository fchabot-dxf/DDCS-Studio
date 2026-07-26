import { test, expect } from '@playwright/test';
import { autoAppDialog, appDialogLog } from './_appDialog.js';   // t684 d — the in-app dialog

/**
 * t1219 — IMPORT SAFETY + ONE-SOURCE EXPORT IDENTITY.
 *
 * Landing a machine bundle FULL-SWAPS this workspace (t1217): the envelope, WCS, macros, variables and controller are
 * all replaced. That is the same blast radius as opening a .ddcs over your work, so it carries the same two
 * protections the .ddcs restore path has always had — an EXPLICIT confirm, and an automatic safety export as the undo
 * path. Both landing sites (file import, cloud load) go through ONE declared gate, so a future third site cannot
 * silently skip it.
 *
 * These paths currently have no UI door (it retired with the profile library), but they stay reachable from the
 * console and the pywebview bridge — "no door today" is not a reason to leave a destructive path unguarded. The file
 * test below drives the REAL importProfile() through the pywebview bridge rather than poking the gate directly.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const BUNDLE = {
    name: 'Imported Rig', controllerId: 'ddcs-v41',
    settings: { machine: { x: 642, y: 300, z: -90, show: true } }, userVars: [],
};

// Boot, put the workspace on a distinctive machine, and stub the pywebview bridge so importProfile() takes its
// desktop path (a real entry point) instead of opening a file picker the test cannot drive.
async function bootWithImportBridge(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsGetMachine && window.ddcsSetMachine);
    await page.evaluate((bundle) => {
        window.ddcsSetMachine({ name: 'Mine', controllerId: 'ddcs-expert-m350' }, true);
        window.ddcsGetSettings().machine = { x: 500, y: 400, z: -120, show: true };
        delete window.__ddcsSafetyExport;
        window.pywebview = { api: { loadProfile: async () => JSON.stringify(bundle) } };
    }, BUNDLE);
}

const liveState = (page) => page.evaluate(async () => {
    const { getActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
    return {
        machine: window.ddcsGetMachine(),
        controller: (getActiveProfile() || {}).id,
        envX: window.ddcsGetSettings().machine.x,
        safety: window.__ddcsSafetyExport || null,
    };
});

test('a file import ASKS before it swaps, and DECLINING leaves the workspace exactly as it was', async ({ page }) => {
    await bootWithImportBridge(page);
    await autoAppDialog(page, { accept: false });   // the user says no

    await page.evaluate(async () => { const s = await import('/data/profileStore.js'); await s.importProfile(); });

    const after = await liveState(page);
    const asked = await appDialogLog(page);
    expect(asked.join(' '), 'the user was asked, and told what the swap costs').toMatch(/REPLACES this workspace's machine/);
    expect(after.machine.name, 'a declined import changes NOTHING about the machine').toBe('Mine');
    expect(after.controller, 'nor the live controller').toBe('ddcs-expert-m350');
    expect(after.envX, 'nor the envelope').toBe(500);
    expect(after.safety, 'and it does not spam an undo export for a swap that never happened').toBeNull();
});

test('accepting takes a SAFETY EXPORT first (the undo path), then the swap lands whole', async ({ page }) => {
    await bootWithImportBridge(page);
    await autoAppDialog(page, { accept: true });

    const dl = page.waitForEvent('download', { timeout: 8000 });
    await page.evaluate(async () => { const s = await import('/data/profileStore.js'); await s.importProfile(); });
    const file = await dl;

    const after = await liveState(page);
    expect(file.suggestedFilename(), 'the undo path is a real .ddcs of the PREVIOUS workspace').toMatch(/before-open.*\.ddcs$/);
    expect(after.safety, 'the safety export ran').not.toBeNull();
    expect(after.machine, 'the workspace became the imported machine').toEqual({ name: 'Imported Rig', controllerId: 'ddcs-v41' });
    expect(after.controller, 'including its LIVE controller — the emit follows the imported machine').toBe('ddcs-v41');
    expect(after.envX, 'and the envelope full-swapped in').toBe(642);
});

/**
 * ONE SOURCE for the exported identity. buildProfile used to stamp the NAME from the machine record but the
 * CONTROLLER from getActiveProfile() — two reads of "which machine is this" in one document, which is how an export
 * ends up labelled for the wrong dialect. A bundle's identity is exactly the thing that must not be assembled from two
 * sources, so this forces the two apart and pins that BOTH fields still come from the record.
 */
test('an exported bundle takes its whole identity from the machine record (never a second source)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsSetMachine && window.ddcsGetMachine);
    const r = await page.evaluate(async () => {
        const store = await import('/data/profileStore.js');
        const { setActiveProfile, getActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        window.ddcsSetMachine({ name: 'Bee', controllerId: 'ddcs-v41' }, false);
        setActiveProfile('ddcs-expert-m350');   // force the divergence the restore fix makes unreachable via the UI
        const b = store.buildProfile();
        return { bundle: { name: b.name, controllerId: b.controllerId }, live: (getActiveProfile() || {}).id };
    });
    expect(r.live, 'the live controller really was the other one').toBe('ddcs-expert-m350');
    expect(r.bundle, 'the bundle carries the RECORD\'s name AND controller — not a mix of two sources')
        .toEqual({ name: 'Bee', controllerId: 'ddcs-v41' });
});

/**
 * THE LEGACY-MACHINES DOOR. migrateProfileLibrary deliberately refuses to delete the non-active profiles from the
 * retired library — losing a machine the user configured is not an acceptable migration cost. That promise is only
 * worth something if the user can act on them, so this is the surface where each is resolved. Resolving the LAST one
 * clears the zombie library key, which is what stops it riding inside every future .ddcs as a legacy `profiles` row.
 */
test('leftover legacy machines surface in Settings, resolve one at a time, and the last one clears the zombie key', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsGetMachine);
    await page.evaluate(() => {
        localStorage.setItem('ddcs_machine', JSON.stringify({ name: 'Active Rig', controllerId: 'ddcs-expert-m350' }));
        localStorage.setItem('ddcs_profile_library', JSON.stringify({ activeId: 'p1', profiles: [
            { id: 'p1', name: 'Active Rig', controllerId: 'ddcs-expert-m350', settings: {}, userVars: [] },
            { id: 'p2', name: 'Old Bee', controllerId: 'ddcs-v41', settings: { machine: { x: 300 } }, userVars: [] },
            { id: 'p3', name: 'Old Router', controllerId: 'generic', settings: {}, userVars: [] },
        ] }));
    });
    await autoAppDialog(page, { accept: true });
    await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_profile' }));
    await page.waitForSelector('#set_legacy_machines', { state: 'visible', timeout: 8000 });

    // the two NON-active machines are offered; the adopted one is not (it IS this workspace)
    await expect(page.locator('#set_legacy_list [data-legacy-save]'), 'one row per leftover machine').toHaveCount(2);
    await expect(page.locator('#set_legacy_list')).toContainText('Old Bee');
    await expect(page.locator('#set_legacy_list')).toContainText('Old Router');
    await expect(page.locator('#set_legacy_list'), 'this workspace\'s OWN machine is not a leftover').not.toContainText('Active Rig');

    // EXPORT the first → a machine-config file the user owns, and that entry is resolved
    const dl = page.waitForEvent('download', { timeout: 8000 });
    await page.locator('#set_legacy_list [data-legacy-save]').first().click();
    const file = await dl;
    expect(file.suggestedFilename(), 'exports as a machine-config file').toMatch(/\.ddcsmachine\.json$/);
    await expect(page.locator('#set_legacy_list [data-legacy-save]'), 'the exported machine is resolved').toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('ddcs_profile_library')),
        'one still unresolved → the library key must NOT be cleared yet').not.toBeNull();

    // DISMISS the last one → the whole zombie key goes and the section hides
    await page.locator('#set_legacy_list [data-legacy-drop]').first().click();
    await expect(page.locator('#set_legacy_machines'), 'nothing left to resolve → the section hides itself').toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('ddcs_profile_library')),
        'the zombie library key is gone, so it stops riding inside every future .ddcs').toBeNull();
});

/**
 * t1219 — THE EXPORTED MACHINE-CONFIG FILE MUST ACTUALLY BE READABLE.
 *
 * The legacy door writes a file and then DELETES the in-app record, so if that file cannot be read back the identity
 * is gone for good. It originally carried the name/controller ONLY as a nested `machine:{…}`, which no reader looks
 * at — the importer reads the TOP LEVEL — so a perfect-looking export re-imported as an unnamed machine on whatever
 * controller the receiving workspace happened to be. This drives the real bytes through the real importer.
 */
test('a legacy machine exports to a file the app can actually READ BACK (identity and all)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetMachine && window.ddcsSetMachine);

    // the exact bytes the Settings door writes, for a machine on a controller the workspace is NOT on
    const body = await page.evaluate(async () => {
        const wm = await import('/data/workspaceMachine.js');
        return wm.machineConfigFile({
            id: 'p2', name: 'Old Bee', controllerId: 'ddcs-v41',
            settings: { machine: { x: 321, y: 200, z: -80, show: true } }, userVars: [],
        });
    });
    expect(JSON.parse(body).kind, 'it is a machine-config file').toBe('ddcs.machine');

    // this workspace is a DIFFERENT machine; now open that file through the REAL import path
    await page.evaluate((json) => {
        window.ddcsSetMachine({ name: 'Receiving Rig', controllerId: 'ddcs-expert-m350' }, true);
        window.ddcsGetSettings().machine = { x: 500, y: 400, z: -120, show: true };
        window.pywebview = { api: { loadProfile: async () => json } };
    }, body);
    await autoAppDialog(page, { accept: true });
    await page.evaluate(async () => { const s = await import('/data/profileStore.js'); await s.importProfile(); });

    const after = await page.evaluate(async () => {
        const { getActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        return { machine: window.ddcsGetMachine(), controller: (getActiveProfile() || {}).id, envX: window.ddcsGetSettings().machine.x };
    });
    expect(after.machine, 'the exported identity survives the round trip — NOT blank, NOT the receiving machine')
        .toEqual({ name: 'Old Bee', controllerId: 'ddcs-v41' });
    expect(after.controller, 'and the live controller became the imported one').toBe('ddcs-v41');
    expect(after.envX, 'along with its settings').toBe(321);
});
