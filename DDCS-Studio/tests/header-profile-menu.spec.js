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
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsSetMachine && window.ddcsGetSettings && document.querySelector('#hdrPostMenu .hdr-quick-head'), null, { timeout: 15000 });   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
    await page.evaluate(() => { window.ddcsSetMachine({ name: 'Rig B' }, false); });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:settings-changed')));
};

test('the compact diet menu: identity line (name·controller, ↧) + one workspace row + Library; the EDITOR file rows are gone, 9 rows', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await seedProfile(page);
    await openMenu(page);
    const m = await page.evaluate(() => {
        const menu = document.getElementById('hdrPostMenu');
        const id = menu.querySelector('.hq-identity');
        return {
            hasIdentity: !!id,
            // t1227 (user) — the identity is a QUIET PLAIN-TEXT LINE, not a button: nothing to press, no handler
            identityIsButton: !!(id && (id.tagName === 'BUTTON' || id.matches('[data-profact]') || id.matches('.hdr-quick-item'))),
            identityName: id ? (id.querySelector('b') || {}).textContent || '' : '',
            identityLabel: id ? (id.querySelector('.hq-identity-txt') || {}).textContent.trim() || '' : '',
            identityCtrl: id ? (id.querySelector('.hq-cur') || {}).textContent || '' : '',
            // …and it sits directly above the Save / Open buttons, so a save has its context
            identityAboveWs: !!(id && id.nextElementSibling && id.nextElementSibling.classList.contains('hq-ws-row')),
            hasCloud: !!menu.querySelector('.hq-identity [data-cloud]'),   // t1243 — must now be FALSE (the badge moved to the manager's Cloud tab)
            hasPull: !!menu.querySelector('.hq-identity .hq-pull-btn[data-profact="pull"]'),
            hasLibrary: menu.querySelectorAll('[data-act="library"]').length,
            // t1227 CURATION — the editor's file rows left this menu for the editor's own corner menu
            gcodeRows: menu.querySelectorAll('.hq-gcode-row').length,
            editorFileActs: menu.querySelectorAll('[data-act="load"], [data-act="insert"], [data-act="export"], [data-act="clear"]').length,
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
            rowCount: menu.querySelectorAll('.hq-identity-line, .hdr-quick-item, .hq-ws-row, .hq-gcode-row, .hdr-quick-subitems[data-subitems="theme"]').length,
            // every row, named — so a count change has to be explained, not just re-numbered
            rowNames: [...menu.querySelectorAll('.hq-identity-line, .hdr-quick-item, .hq-ws-row, .hdr-quick-subitems[data-subitems="theme"]')]
                .map((r) => r.dataset.act || r.dataset.subitems || r.className.split(' ')[0]),
        };
    });
    // The identity LINE — display only (t1227), with its two live sub-targets
    expect(m.hasIdentity, 'the identity line').toBe(true);
    expect(m.identityIsButton, 'it is NOT a button any more — its click served the retired profile world').toBe(false);
    expect(m.identityAboveWs, 'it sits directly above Save / Open (save context)').toBe(true);
    expect(m.identityName, 'identity shows the WORKSPACE name (t1217 — from the machine record)').toMatch(/Rig B/);
    // t1249 (user) — and the line SAYS what it describes, in the disk tooltip's wording
    expect(m.identityLabel, 'the line is labelled, so the name has a subject').toMatch(/^Workspace:/);
    expect(m.identityCtrl, 'and the dialect after it').toMatch(/·/);
    expect(m.hasCloud, 'the cloud badge is RETIRED (t1243) — cloud lives in the workspace manager Cloud tab, one door not two').toBe(false);
    expect(m.hasPull, 'so does the ↧ pull tap target').toBe(true);
    // The compact rows
    expect(m.hasLibrary, 'Library row').toBe(1);
    expect(m.gcodeRows, 'the gcode row is GONE — Load/Insert/Export live in the editor corner menu now').toBe(0);
    expect(m.editorFileActs, 'no editor file action survives in this menu (Load/Insert/Export/Clear)').toBe(0);
    expect(m.wsRows, 'ONE workspace row').toBe(1);
    expect(m.wsBtns, 'Save + Open inline (the workspace manager\'s two entry points)').toBe(2);
    expect(m.hasSetupSheet + m.hasSettings + m.hasRate, 'the app-level rows stay: Setup sheet + Settings + Rate').toBe(3);
    expect(m.hasClear, 'Clear editor is NOT app-level — it went to the editor corner menu').toBe(0);
    expect(m.themeChips, 'theme swatches present').toBeGreaterThan(1);
    // RETIRED shape gone
    expect(m.recents, 'no recents rows (moved to the Library)').toBe(0);
    expect(m.saveasRows + m.saveRows + m.openRows + m.wizardRows + m.standaloneRows, 'Save/Open/Save-as/Save-as-wizard/Standalone all moved out of the menu').toBe(0);
    expect(m.dialectItems, 'no dialect list').toBe(0);
    expect(m.oldCur, 'the old .hdr-quick-cur profile line is gone').toBe(0);
    expect(m.generateFor, 'the "Generate for" label is gone').toBe(false);
    // The diet target, re-encoded honestly after the t1227 curation — and it came DOWN, as t1225 said it would:
    // identity · workspace · Library · theme · setup sheet · checklist · settings · rate. Nothing is hidden from the
    // count by class (the t1225 lesson); the rows are NAMED so the next change has to say what it added or removed.
    expect(m.rowNames, 'exactly these rows, in this order').toEqual([
        'hq-identity-line', 'hq-ws-row', 'wizards', 'library', 'theme', 'setupSheet', 'checklist', 'settings', 'help', 'rate',
    ]);
    // t1245 — the count goes UP by one, and that is stated rather than quietly re-numbered: HELP came OUT of Settings
    // (FAQ + About are not settings), so the menu gained a row while Settings lost five subtabs. A diet number that
    // only ever falls would be a number kept true by not counting.
    // t1617 — up by one AGAIN, stated: the WIZARD MANAGER's entry (Wizards…) lands beside the workspace row it is
    // the sibling of. Wizard lifecycle earned a user-facing door; the row is the door.
    expect(m.rowCount, 'the diet menu is 10 rows (9 + the t1617 Wizards… row)').toBe(10);

    // the identity's two TAP TARGETS are each ≥44px (the mock's touch requirement). The line itself is no longer a
    // target, so it is no longer measured as one — t1227 made it display-only.
    const box = async (sel) => (await page.locator(sel).first().boundingBox()) || { width: 0, height: 0 };
    const pullB = await box('.hq-identity .hq-pull-btn');
    expect(Math.min(pullB.width, pullB.height), 'the ↧ target is ≥44px (the ☁ one retired with the badge, t1243)').toBeGreaterThanOrEqual(44);
});

test('the identity line taps: it does NOTHING itself; ↧ → pull flow (the ☁ badge retired, t1243)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await seedProfile(page);

    // TAPPING THE LINE does nothing — no settings, and the menu stays put (t1227: display only)
    await openMenu(page);
    await page.click('.hq-identity-txt');
    await expect(page.locator('#settings-app')).toBeHidden();
    await expect(page.locator('#hdrPostMenu'), 'a dead press does not even close the menu').toBeVisible();
    await page.keyboard.press('Escape');   // it stayed open, so close it before the next step re-opens it

    // t1243 — the ☁ tap is GONE from this menu (cloud moved to the workspace manager's Cloud tab; its own spec,
    // header-account-row-742, now proves the phone route end to end).

    // ↧ PULL tap → the pull flow (Settings → Controller → Profile, where the pull lives)
    await openMenu(page);
    await page.click('.hq-identity .hq-pull-btn[data-profact="pull"]');
    await expect(page.locator('#settings-app')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#set_tab_profile')).toBeVisible({ timeout: 6000 });
});
