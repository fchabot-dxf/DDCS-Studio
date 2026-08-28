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
// t2099 — t2078 (human: "the load insert export button can go in the quick menu") REVERSED t1227's own gcode-row
// removal below: Load/Insert/Export are back in this menu (as hdr-quick-item rows, data-act="fileLoad" etc — not
// the retired .hq-gcode-row/data-act="load" shape this file used to check for), because those three act on the
// program AS A WHOLE, never mid-edit. Clear alone stayed out (t1255) — the editor's own toolbar owns it now.
const seedProfile = async (page) => {
    // t2147 — the old signal (.hdr-quick-head, the Theme section's heading) is GONE with the theme section
    // itself (BACKLOG #1); .hq-identity-line is unconditional (rendered on every fillMenu(), theme or not),
    // so it is the stable "the menu has been filled at least once" signal now.
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsSetMachine && window.ddcsGetSettings && document.querySelector('#hdrPostMenu .hq-identity-line'), null, { timeout: 15000 });   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
    // t2145 — the identity line's name is the last-SAVED .ddcs file's name (BACKLOG F2), not a machine-record
    // field; stamp that directly rather than a name nothing reads any more.
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('Rig B.ddcs'); });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:settings-changed')));
};

test('the FILE menu: identity line (name·controller, ↧) + four labelled sections; the file rows are BACK (t2078), 6 rows (t2184 grid restructure)', async ({ page }) => {
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
            // …and it sits directly above the Save / Open buttons (t2147 — with the new Saved-line between them
            // now, BACKLOG #7), so a save has its context. t2184 (amendment 13) — the identity line now lives
            // INSIDE the Workspace section, as its first row; saved-line comes right after, then Save/Open.
            identityAboveWs: !!(id && id.nextElementSibling && id.nextElementSibling.nextElementSibling
                && id.nextElementSibling.nextElementSibling.classList.contains('hq-ws-row')),
            hasCloud: !!menu.querySelector('.hq-identity [data-cloud]'),   // t1243 — must now be FALSE (the badge moved to the manager's Cloud tab)
            hasPull: !!menu.querySelector('.hq-identity .hq-pull-btn[data-profact="pull"]'),
            hasLibrary: menu.querySelectorAll('[data-act="library"]').length,
            // t2099 — t2078 REVERSED t1227's removal: Load/Insert/Export came back, as plain hdr-quick-item rows
            // (data-act="fileLoad"/"fileInsert"/"fileExport"), not the retired .hq-gcode-row/data-act="load"
            // shape. t2173 — Insert removed entirely (human: too close a duplicate of Load); fileRows counts
            // only the two survivors now, and fileInsertCount below locks the removal itself.
            fileRows: menu.querySelectorAll('[data-act="fileLoad"], [data-act="fileExport"]').length,
            fileInsertCount: menu.querySelectorAll('[data-act="fileInsert"]').length,
            hasClear: menu.querySelectorAll('[data-act="clear"]').length,
            hasSetupSheet: menu.querySelectorAll('[data-act="setupSheet"]').length,
            // t2184 (amendment 2) — Settings is BACK in this menu (workspace content — saved into the .ddcs),
            // so it's asserted PRESENT below, not in this absence list any more.
            hasSettings: menu.querySelectorAll('[data-act="settings"]').length,
            // t2149 (BACKLOG #9) — FAQ/About/getDesktop/Rate/version all MOVED OUT to the new #hdrAppMenu;
            // asserted absent from THIS menu here, present in the app menu by header-menu-split-2149.spec.js.
            appScopedLeaked: menu.querySelectorAll('[data-act="helpFaq"], [data-act="helpAbout"], [data-act="getDesktop"], [data-act="rate"]').length,
            themeChips: menu.querySelectorAll('.hq-theme-chip[data-theme]').length,
            // t2147 (BACKLOG #1/#7) — theme is gone from this menu (Settings' own #set_theme picker is the one
            // door now); the "Saved …" line and the version footer are new.
            hasThemeSection: menu.querySelectorAll('.hdr-quick-subitems, .hdr-quick-head').length,
            savedLine: menu.querySelectorAll('.hq-saved-line').length,
            savedLineText: (menu.querySelector('.hq-saved-line .hq-cur') || {}).textContent || '',
            verFooter: menu.querySelectorAll('.hq-ver-footer').length,
            verFooterText: (menu.querySelector('.hq-ver-footer') || {}).textContent || '',
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
            rowCount: menu.querySelectorAll('.hq-identity-line, .hq-saved-line, .hdr-quick-item, .hq-ws-row, .hq-ver-footer').length,
            // every row, named — so a count change has to be explained, not just re-numbered. t2184 — FOUR
            // `.hq-ws-row` pairs now exist (Workspace/G-code/Project/Reference), not one, so a bare className
            // would make them indistinguishable; name each by the data-acts of the buttons it holds instead.
            rowNames: [...menu.querySelectorAll('.hq-identity-line, .hq-saved-line, .hdr-quick-item, .hq-ws-row, .hq-ver-footer')]
                .map((r) => r.dataset.act || (r.classList.contains('hq-ws-row')
                    ? 'hq-ws-row:' + [...r.querySelectorAll('[data-act]')].map((b) => b.dataset.act).join('+')
                    : r.className.split(' ')[0])),
        };
    });
    // The identity LINE — display only (t1227), with its two live sub-targets
    expect(m.hasIdentity, 'the identity line').toBe(true);
    expect(m.identityIsButton, 'it is NOT a button any more — its click served the retired profile world').toBe(false);
    expect(m.identityAboveWs, 'it sits directly above Save / Open (save context)').toBe(true);
    expect(m.identityName, 'identity shows the WORKSPACE name (t2145 — the last-saved .ddcs file\'s name)').toMatch(/Rig B/);
    // t1249 (user) — the line USED TO carry its own "Workspace: " label so a reader could tell what it named.
    // t2184 (amendment 13) — DROPPED: the line now lives inside the box titled WORKSPACE, so the subject is
    // already stated once, by the section header.
    expect(m.identityLabel, 'no "Workspace: " prefix any more — the section title states the subject').not.toMatch(/^Workspace:/);
    expect(m.identityCtrl, 'and the dialect after it').toMatch(/·/);
    expect(m.hasCloud, 'the cloud badge is RETIRED (t1243) — cloud lives in the workspace manager Cloud tab, one door not two').toBe(false);
    expect(m.hasPull, 'so does the ↧ pull tap target').toBe(true);
    // The compact rows
    expect(m.hasLibrary, 'Library row').toBe(1);
    expect(m.fileRows, 'Load/Export are BACK (t2078) — they act on the program as a whole').toBe(2);
    expect(m.fileInsertCount, 'Insert stays removed (t2173)').toBe(0);
    // t2184 (amendments 2/3/16) — FOUR two-column `.hq-ws-row` GRIDS now: Workspace (Save/Open/Wizards/
    // Settings, 2x2), G-code (Save as/Open), Project (Save/Open), Reference (Setup sheet/Setup checklist) —
    // not one.
    expect(m.wsRows, 'four grids (Workspace/G-code/Project/Reference), not one').toBe(4);
    expect(m.wsBtns, 'Save + Open inline (the workspace manager\'s two entry points)').toBe(2);
    expect(m.hasSetupSheet, 'Setup sheet stays — it is FILE-scoped (a document ABOUT this job)').toBe(1);
    expect(m.hasSettings, 't2184 (amendment 2) — Settings is BACK: it is saved into the .ddcs, workspace content').toBe(1);
    expect(m.appScopedLeaked, 't2149 — FAQ/getDesktop/Rate moved OUT to the app menu, none leaked back in').toBe(0);
    expect(m.hasClear, 'Clear alone stayed OUT (t1255) — the editor toolbar\'s own trash owns it').toBe(0);
    // t2147 (BACKLOG #1) — NO theme in this menu any more: not the chips, not even the section shell (leave
    // nothing behind — a row that merely opened Settings would still be the row the item meant to free).
    expect(m.themeChips, 'no theme swatches — Settings\' own #set_theme picker is the one door now').toBe(0);
    expect(m.hasThemeSection, 'no leftover theme section shell either').toBe(0);
    // t2147 (BACKLOG #7) — the new "Saved …" line: WHEN + WHERE, present because seedProfile() stamped a save.
    expect(m.savedLine, 'the Saved line is present once a file exists').toBe(1);
    expect(m.savedLineText, 'it says WHEN').toMatch(/^Saved /);
    // t2149 (BACKLOG #9) — the version footer moved OUT of this menu into the app menu; asserted absent here.
    expect(m.verFooter, 'no version footer in the FILE menu any more').toBe(0);
    // RETIRED shape gone
    expect(m.recents, 'no recents rows (moved to the Library)').toBe(0);
    expect(m.saveasRows + m.saveRows + m.openRows + m.wizardRows + m.standaloneRows, 'Save/Open/Save-as/Save-as-wizard/Standalone all moved out of the menu').toBe(0);
    expect(m.dialectItems, 'no dialect list').toBe(0);
    expect(m.oldCur, 'the old .hdr-quick-cur profile line is gone').toBe(0);
    expect(m.generateFor, 'the "Generate for" label is gone').toBe(false);
    // The diet target, re-encoded honestly after the t1227 curation. Nothing is hidden from the count by class
    // (the t1225 lesson); the rows are NAMED so the next change has to say what it added or removed.
    // t2184 (scratchpad/t-filemenu-sections.md, amendments 2/3/16) — FOUR SECTIONS, each ONE shared-style grid:
    // Wizards and Settings are no longer standalone `.hdr-quick-item` rows either (amendment 16 retired that
    // distinction entirely) — every action in a section is one `.hq-ws-btn` inside that section's single
    // `.hq-ws-row` grid, named below by the data-acts it holds. Amendment 17 — G-code's save action leads
    // (fileExport before fileLoad).
    expect(m.rowNames, 'exactly these rows, in this order').toEqual([
        'hq-identity-line', 'hq-saved-line',
        'hq-ws-row:wsSave+wsOpen+wizards+settings',
        'hq-ws-row:fileExport+fileLoad',
        // t2361 (BACKLOG #37) — Project gains a third act, projInsert ("Insert op…", the preset successor).
        'hq-ws-row:projSave+library+projInsert',
        'hq-ws-row:setupSheet+checklist',
    ]);
    // t1245/t1617/t2099 grew this menu across three turns (see WORK-LOG for that history); t2149 shrank it —
    // five app-scoped rows moved out. t2173 (tail) shrank it again (Insert removed). t2184 restructured it into
    // four one-grid-each sections (net: Settings returns, Project gains a real Save… row, Wizards/Settings fold
    // into their section's grid instead of standing alone) — 6 rows.
    expect(m.rowCount, 'the FILE menu is 6 rows after the t2184 grid restructure').toBe(6);

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
