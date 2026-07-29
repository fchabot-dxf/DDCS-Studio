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

test('accepting lands the swap whole — and never downloads a file nobody asked for (t1223 sweep)', async ({ page }) => {
    await bootWithImportBridge(page);
    // a CLEAN buffer has nothing to protect, so the save-first prompt correctly does not appear; the import confirm is
    // the only ask. (A dirty buffer gets the three-way prompt — that path is covered in workspace-manager-1223.)
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('before.ddcs'); window.ddcsFileSaveState.refresh(); });
    await autoAppDialog(page, { accept: true });

    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    const run = page.evaluate(async () => { const s = await import('/data/profileStore.js'); await s.importProfile(); });
    // if boot left the buffer dirty, the save-first prompt appears — Discard is the "proceed without saving" answer.
    // (That prompt REPLACING the old silent download is the whole point of the sweep, so answering it is the flow.)
    const ask = page.locator('.wsm-3way');
    try { await ask.waitFor({ state: 'visible', timeout: 2500 }); await ask.locator('[data-w3="discard"]').click(); } catch (_) { /* clean buffer → no prompt */ }
    await run;
    await page.waitForFunction(() => (window.ddcsGetMachine() || {}).name === 'Imported Rig', null, { timeout: 8000 });

    const after = await liveState(page);
    expect(downloaded, 'the silent safety download is GONE — an unasked-for file is not consent').toBe(false);
    expect(after.safety, 'and nothing pretended to export one').toBeNull();
    // t1369 — THE IDENTITY IS ASSERTED, NOT THE RECORD'S EXACT SHAPE. This was `toEqual`, which demands the machine
    // record hold EXACTLY the two keys the import declares — so it broke the moment the record grew kind/chuck/
    // toolPost (the lathe work), none of which the import is about. Stale by construction: any field ever added to a
    // machine fails it. What must be true is that the imported IDENTITY landed and nothing of the old machine
    // survived it, and both are still checked — the second one explicitly, so this cannot pass on a partial swap.
    expect(after.machine, 'the workspace became the imported machine').toMatchObject({ name: 'Imported Rig', controllerId: 'ddcs-v41' });
    expect(JSON.stringify(after.machine), 'and nothing of the machine it replaced survived the swap').not.toMatch(/before|Bee|previous/i);
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
 * t1223 — TWO TESTS REMOVED HERE ([[no-legacy-burden]]), not bent:
 *   · "leftover legacy machines surface in Settings…" — the legacy-machines door is purged.
 *   · "a legacy machine exports to a file the app can actually READ BACK…" — machineConfigFile and the whole
 *     .ddcsmachine.json format are purged with it.
 * Both covered features that existed only to carry a pre-t1217 browser across the pivot. The import SAFETY they
 * shared (confirm + automatic undo copy) is still covered by the tests above, which test the live import path.
 */
