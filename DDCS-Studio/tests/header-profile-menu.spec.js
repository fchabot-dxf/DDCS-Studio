import { test, expect } from '@playwright/test';

/**
 * t688 b2 — the header quick-menu's "Generate for" (dialect) section is REPLACED by a PROFILE section: a read-only
 * current profile+controller line, up to 3 recents (one-click full-swap), and [Profiles…] [Save as…] [Pull from
 * controller]. NO dialect/controller switching in the menu (that stays on the Settings controller dropdown).
 *
 * t1217 — the identity row now names THIS WORKSPACE'S MACHINE ([[one-workspace-one-machine]]). Recents / Save-as /
 * profile switching are retired with the library, and the row's tap opens the machine's settings.
 */
const openMenu = async (page) => { await page.click('#hdrPostBtn'); await page.waitForSelector('#hdrPostMenu:not([hidden])', { timeout: 4000 }); };

// t859 — REWRITTEN for the t851 MENU DIET. The retired "Profile section (head + recents + [Profiles…][Save as…][Pull])"
// is GONE; profile lives in the ONE compound IDENTITY row (name · controller · ☁ cloud state, with the ↧ pull icon).
// Recents + Save-as moved to the Library; Save/Open moved to the Library; dialect list already gone.
// t1217 — the name now comes from THIS WORKSPACE'S MACHINE record, not the retired profile library.
const seedProfile = async (page) => {
    await page.waitForFunction(() => window.ddcsSetMachine && window.ddcsGetSettings && document.querySelector('#hdrPostMenu .hdr-quick-head'), null, { timeout: 15000 });
    await page.evaluate(() => { window.ddcsSetMachine({ name: 'Rig B' }, false); });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:settings-changed')));
};

test('the compact diet menu: identity row (name·controller, ☁, ↧) + Library + one gcode row + one workspace row; retired profile section GONE, ≤10 rows', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await seedProfile(page);
    await openMenu(page);
    const m = await page.evaluate(() => {
        const menu = document.getElementById('hdrPostMenu');
        const id = menu.querySelector('.hq-identity');
        return {
            hasIdentity: !!id,
            identityIsBrowse: !!(id && id.matches('[data-profact="browse"]')),
            identityName: id ? (id.querySelector('b') || {}).textContent || '' : '',
            identityCtrl: id ? (id.querySelector('.hq-cur') || {}).textContent || '' : '',
            hasCloud: !!menu.querySelector('.hq-identity [data-cloud]'),
            hasPull: !!menu.querySelector('.hq-identity .hq-pull-btn[data-profact="pull"]'),
            hasLibrary: menu.querySelectorAll('[data-act="library"]').length,
            gcodeRows: menu.querySelectorAll('.hq-gcode-row').length,
            gcodeBtns: menu.querySelectorAll('.hq-gcode-row .hq-gcode-btn[data-act]').length,
            hasClear: menu.querySelectorAll('[data-act="clear"]').length,
            hasSetupSheet: menu.querySelectorAll('[data-act="setupSheet"]').length,
            hasSettings: menu.querySelectorAll('[data-act="settings"]').length,
            hasRate: menu.querySelectorAll('[data-act="rate"]').length,
            themeChips: menu.querySelectorAll('.hq-theme-chip[data-theme]').length,
            // RETIRED shape — must be absent
            recents: menu.querySelectorAll('[data-profswitch]').length,
            saveasRows: menu.querySelectorAll('[data-profact="saveas"]').length,
            saveRows: menu.querySelectorAll('[data-act="save"]').length,
            openRows: menu.querySelectorAll('[data-act="open"]').length,
            wizardRows: menu.querySelectorAll('[data-act="wizard"]').length,
            standaloneRows: menu.querySelectorAll('[data-act="standalone"]').length,
            dialectItems: menu.querySelectorAll('[data-post]').length,
            oldCur: menu.querySelectorAll('.hdr-quick-cur').length,
            generateFor: /Generate for/.test(menu.textContent),
            // t1225 — count EVERY visible row, including the t1223 workspace row. It has its own class (a workspace
            // row is not a gcode row), and leaving that class out of this selector made the count read 9 while the
            // menu showed 10 — a diet number kept true by not looking. The declared target moves instead.
            wsRows: menu.querySelectorAll('.hq-ws-row').length,
            wsBtns: menu.querySelectorAll('.hq-ws-row [data-act="wsSave"], .hq-ws-row [data-act="wsOpen"]').length,
            rowCount: menu.querySelectorAll('.hdr-quick-item, .hq-ws-row, .hq-gcode-row, .hdr-quick-subitems[data-subitems="theme"]').length,
        };
    });
    // The ONE compound identity row + its three affordances
    expect(m.hasIdentity, 'the compound identity row').toBe(true);
    expect(m.identityIsBrowse, 'the identity row opens the machine settings (data-profact=browse)').toBe(true);
    expect(m.identityName, 'identity shows the MACHINE name (t1217 — from the machine record)').toMatch(/Rig B/);
    expect(m.identityCtrl, 'identity shows the controller').toMatch(/·/);
    expect(m.hasCloud, 'the ☁ cloud-state tap target').toBe(true);
    expect(m.hasPull, 'the ↧ pull tap target').toBe(true);
    // The compact rows
    expect(m.hasLibrary, 'Library row').toBe(1);
    expect(m.gcodeRows, 'ONE gcode row').toBe(1);
    expect(m.gcodeBtns, 'Load / Insert / Export inline').toBe(3);
    expect(m.wsRows, 'ONE workspace row').toBe(1);
    expect(m.wsBtns, 'Save + Open inline (the workspace manager\'s two entry points)').toBe(2);
    expect(m.hasClear + m.hasSetupSheet + m.hasSettings + m.hasRate, 'Clear + Setup sheet + Settings + Rate all present').toBe(4);
    expect(m.themeChips, 'theme swatches present').toBeGreaterThan(1);
    // RETIRED shape gone
    expect(m.recents, 'no recents rows (moved to the Library)').toBe(0);
    expect(m.saveasRows + m.saveRows + m.openRows + m.wizardRows + m.standaloneRows, 'Save/Open/Save-as/Save-as-wizard/Standalone all moved out of the menu').toBe(0);
    expect(m.dialectItems, 'no dialect list').toBe(0);
    expect(m.oldCur, 'the old .hdr-quick-cur profile line is gone').toBe(0);
    expect(m.generateFor, 'the "Generate for" label is gone').toBe(false);
    // The diet target, declared honestly: the workspace row made it 10, so 10 is what it says. (The upcoming curation
    // batch slims the menu; when it lands this number comes DOWN — it does not get worked around again.)
    expect(m.rowCount, 'the diet menu is ≤10 rows').toBeLessThanOrEqual(10);

    // the three identity tap targets are each ≥44px (the mock's touch requirement)
    const box = async (sel) => (await page.locator(sel).first().boundingBox()) || { width: 0, height: 0 };
    const rowB = await box('.hq-identity'), cloudB = await box('.hq-identity [data-cloud]'), pullB = await box('.hq-identity .hq-pull-btn');
    expect(Math.min(rowB.height), 'the identity ROW is ≥44px tall').toBeGreaterThanOrEqual(44);
    expect(Math.min(cloudB.width, cloudB.height), 'the ☁ target is ≥44px').toBeGreaterThanOrEqual(44);
    expect(Math.min(pullB.width, pullB.height), 'the ↧ target is ≥44px').toBeGreaterThanOrEqual(44);
});

test('the identity row taps: row → the MACHINE settings, ☁ → connect, ↧ → pull flow', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await seedProfile(page);

    // ROW tap → this workspace's MACHINE settings (t1217 — was the Library's Profiles tab, retired with the library)
    await openMenu(page);
    await page.click('.hq-identity');
    await expect(page.locator('#settings-app')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#set_tab_profile')).toBeVisible();   // t1223 — the name INPUT died with the one-name rule; the panel is the destination
    await page.evaluate(() => window.closeSettings && window.closeSettings());
    await expect(page.locator('#settings-app')).toBeHidden();

    // ☁ CLOUD tap → the cloud connect flow (not connected → the login/connect UI)
    await openMenu(page);
    await page.click('.hq-identity [data-cloud]');
    // scope to the MODAL's own mount — Settings hosts a second, hidden .cloud-login (the shared component)
    await expect(page.locator('.cloud-account-ov .cloud-login, .cloud-account-ov .cloud-connect').first()).toBeVisible({ timeout: 6000 });
    await page.keyboard.press('Escape');

    // ↧ PULL tap → the pull flow (Settings → Controller → Profile, where the pull lives)
    await openMenu(page);
    await page.click('.hq-identity .hq-pull-btn[data-profact="pull"]');
    await expect(page.locator('#settings-app')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#set_tab_profile')).toBeVisible({ timeout: 6000 });
});
