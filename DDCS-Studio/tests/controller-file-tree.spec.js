import { test, expect } from '@playwright/test';

/**
 * CONTROLLER-AWARE MACROS TAB — the FILE WORKSPACE (t662, E1). Each controller DECLARES its file tree
 * (data/controllerFiles); the Macros tab renders the ACTIVE controller's tree ALWAYS. Expert wraps today's builder
 * panels (unchanged); V4.1/DM500 show their real firmware files in the generalized simple editor, body stored IN THE
 * PROFILE (settings.workspace) so it rides the profile snapshot/full-swap/export/cloud. Transport per connectivity:
 * V4.1 = LAN push, DM500 = USB export (no push, no global deploy).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const openMacros = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => typeof window.showApp === 'function' && window.ddcsSetMachine && window.ddcsGetSettings);
    await page.evaluate(() => { localStorage.removeItem('ddcs_profile_library'); });
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForFunction(() => document.querySelector('#macros_tree .settings-tab'));
};
// t1217 — retargeting the workspace's controller is setMachine (was profileLibrary.setActiveControllerId)
const setController = (page, id) => page.evaluate((cid) => window.ddcsSetMachine({ controllerId: cid }, true), id);
const treeFiles = (page) => page.evaluate(() => [...document.querySelectorAll('#macros_tree .settings-tab')]
    .map((b) => b.querySelector('div')?.textContent || ''));

test('the tree renders the ACTIVE controller declaration: Expert wraps panels, V4.1 = its firmware files (LAN push), DM500 = install files (USB export, no LAN)', async ({ page }) => {
    await openMacros(page);
    // Expert (default) — its builder tree; slib-m.nc → the M-codes panel is selected by default (byte-equal wrap)
    await setController(page, 'ddcs-expert-m350');
    const expert = await treeFiles(page);
    expect(expert, 'Expert shows its SYSDISK builder surfaces').toEqual(expect.arrayContaining(['slib-m.nc', 'sysstart.nc', 'T.nc', 'key-N.nc', 'macro_camN.nc']));
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('macros_panel_mcode')).display !== 'none'), 'Expert default panel = M-codes (unchanged)').toBeTruthy();

    // V4.1 — its real firmware set; a plain file opens the simple editor with a LAN Push button; global deploy visible
    await setController(page, 'ddcs-v41');
    await page.waitForFunction(() => [...document.querySelectorAll('#macros_tree .settings-tab')].some((b) => /probe-fix\.nc/.test(b.textContent)));
    const v41 = await treeFiles(page);
    expect(v41, 'V4.1 shows its firmware files (not the Expert builders)').toEqual(expect.arrayContaining(['advstart.nc', 'M6.rc', 'selcoord.nc', 'probe-fix.nc', 'gotoz.nc', 'safez.nc']));
    expect(v41, 'V4.1 has NO CAM builder file').not.toContain('macro_camN.nc');
    // open probe-fix.nc → the simple editor, seeded from the dump, LAN Push
    await page.evaluate(() => [...document.querySelectorAll('#macros_tree .settings-tab')].find((b) => /probe-fix\.nc/.test(b.textContent)).click());
    await page.waitForFunction(() => document.getElementById('macfile_body'));
    const v41file = await page.evaluate(() => ({
        seeded: document.getElementById('macfile_body').value,
        sendLabel: (document.getElementById('macfile_send') || {}).textContent || '',
        globalPush: getComputedStyle(document.getElementById('mac_btn_global_push')).display !== 'none',
    }));
    expect(v41file.seeded, 'probe-fix.nc opens seeded from the V4.1 dump copy').toContain('G31Z-1000L#682');
    expect(v41file.sendLabel, 'V4.1 file → LAN Push').toContain('Push');
    expect(v41file.globalPush, 'V4.1 (LAN) keeps the global deploy button').toBeTruthy();

    // DM500 — its install set; plain editors; EXPORT (no LAN); the global deploy button is hidden
    await setController(page, 'ddcs-v3-dm500');
    await page.waitForFunction(() => [...document.querySelectorAll('#macros_tree .settings-tab')].some((b) => /defprobe\.nc/.test(b.textContent)));
    const dm = await treeFiles(page);
    expect(dm, 'DM500 shows its install macros').toEqual(expect.arrayContaining(['probe.nc', 'defprobe.nc', 'slib.nc', 'safez.nc']));
    await page.evaluate(() => [...document.querySelectorAll('#macros_tree .settings-tab')].find((b) => /defprobe\.nc/.test(b.textContent)).click());
    await page.waitForFunction(() => document.getElementById('macfile_body'));
    const dmfile = await page.evaluate(() => ({
        seeded: document.getElementById('macfile_body').value,
        sendLabel: (document.getElementById('macfile_send') || {}).textContent || '',
        globalPush: getComputedStyle(document.getElementById('mac_btn_global_push')).display !== 'none',
    }));
    expect(dmfile.seeded, 'defprobe.nc opens seeded from the DM500 dump copy').toContain('#2000 Cutter diameter');
    expect(dmfile.sendLabel, 'DM500 file → USB Export (no LAN)').toContain('Export');
    expect(dmfile.globalPush, 'DM500 (no LAN) hides the global deploy button').toBeFalsy();

    await page.screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad/macros-dm500-tree.png' });
});

// t1217 — the second half of this test ("switching profiles SWAPS the workspace") is RETIRED with the profile library
// ([[one-workspace-one-machine]]): a workspace holds exactly one machine, so there is nothing to switch between and no
// swap to assert. What remains is the part that still describes the shipped app — an edited file body persists into the
// workspace's own settings and survives a reload. The cross-workspace equivalent (each .ddcs carries its own file
// bodies) is covered by tests/workspace-roundtrip.spec.js.
test('editing a plain file persists in the workspace (survives reload)', async ({ page }) => {
    await openMacros(page);
    await setController(page, 'ddcs-v41');
    await page.evaluate(() => window.ddcsSetMachine({ name: 'Rig A' }, false));
    await page.waitForFunction(() => [...document.querySelectorAll('#macros_tree .settings-tab')].some((b) => /probe-fix\.nc/.test(b.textContent)));
    await page.evaluate(() => [...document.querySelectorAll('#macros_tree .settings-tab')].find((b) => /probe-fix\.nc/.test(b.textContent)).click());
    await page.waitForFunction(() => document.getElementById('macfile_body'));
    await page.evaluate(() => { const ta = document.getElementById('macfile_body'); ta.value = 'G0 X1 ( A EDIT )'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
    const storedA = await page.evaluate(() => window.ddcsGetSettings().workspace['probe-fix.nc']);
    expect(storedA, 'the edit persists into settings.workspace (in the profile)').toBe('G0 X1 ( A EDIT )');

    // reload → reopen → the edited body persists
    await page.reload();
    await page.waitForFunction(() => typeof window.showApp === 'function' && window.ddcsGetSettings);
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForFunction(() => document.querySelector('#macros_tree .settings-tab'));
    await page.evaluate(() => [...document.querySelectorAll('#macros_tree .settings-tab')].find((b) => /probe-fix\.nc/.test(b.textContent)).click());
    await page.waitForFunction(() => document.getElementById('macfile_body'));
    expect(await page.evaluate(() => document.getElementById('macfile_body').value), 'the edit survives reload (stored in the workspace)').toBe('G0 X1 ( A EDIT )');

    // …and the machine record survived the reload with it (the workspace still identifies as Rig A)
    expect(await page.evaluate(() => window.ddcsGetMachine().name), 'the machine name persists across the reload').toBe('Rig A');
});
