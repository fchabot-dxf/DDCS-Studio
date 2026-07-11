import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';   // t684 d — in-app dialog

/**
 * PROFILES FIRST-CLASS (t658). A named PROFILE bundles {name, controllerId, settings, userVars}; the CONTROLLER is a
 * property. THE GUARD: switching FULL-SWAPS the live settings (never a partial merge), so the envelope / WCS / autostart /
 * one-source seams (motors, homing) swap ATOMICALLY and can't bleed across profiles. Migration wraps the current state as
 * one UNNAMED profile (byte-preserving; the user names it). This asserts the swap-both-ways VALUES + the migration.
 */
test.use({ viewport: { width: 1000, height: 800 } });

test('the switch FULL-SWAPS envelope + WCS + autostart both ways — no bleed (the GUARD); migration is unnamed + byte-preserving', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        localStorage.removeItem('ddcs_profile_library');   // force a fresh migration
        const lib = await import('/data/profileLibrary.js');
        const { getSettings } = await import('/ui/settingsPanel.js');
        // profile A = the migrated default: set a distinctive envelope / WCS / autostart, snapshot it
        const s = getSettings();
        s.machine = { x: 600, y: 400, z: 500, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [{ x: 10, y: 20, z: 30 }] } };
        s.autostartBody = 'AAA-boot';
        s.motors = { ...s.motors, a: { role: 'slave', follows: 'y' } };   // a one-source seam (gantry)
        const aId = lib.getLibrary().activeId;
        const migratedName = lib.getLibrary().profiles.find((p) => p.id === aId).name;
        lib.saveActiveSnapshot();

        // profile B = a fresh baseline on the SAME controller, with a DIFFERENT envelope / WCS / autostart / no gantry
        const bId = lib.createProfile({ from: 'baseline', controllerId: 'ddcs-expert-m350', name: 'Big table' });
        const sB = getSettings();
        sB.machine = { x: 300, y: 200, z: 100, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [{ x: 99, y: 88, z: 77 }] } };
        sB.autostartBody = 'BBB-boot';
        lib.saveActiveSnapshot();

        // switch to A → read; switch to B → read (both full-swap)
        lib.switchProfile(aId, true);
        const onA = { mx: getSettings().machine.x, wcsX: (getSettings().machine.wcs.table[0] || {}).x, auto: getSettings().autostartBody, slave: (getSettings().motors.a || {}).role };
        lib.switchProfile(bId, true);
        const onB = { mx: getSettings().machine.x, wcsX: (getSettings().machine.wcs.table[0] || {}).x, auto: getSettings().autostartBody, slave: (getSettings().motors.a || {}).role };
        return { onA, onB, migratedName, count: lib.listProfiles().length };
    });
    // A COMPLETELY (no B bleed): envelope 600, WCS X=10, autostart AAA, gantry slave present
    expect(r.onA.mx, 'A envelope 600').toBe(600);
    expect(r.onA.wcsX, 'A WCS G54 X=10').toBe(10);
    expect(r.onA.auto, 'A autostart AAA').toBe('AAA-boot');
    expect(r.onA.slave, 'A gantry seam preserved (motors.a=slave)').toBe('slave');
    // B COMPLETELY (no A bleed): envelope 300, WCS X=99, autostart BBB, NO gantry slave (fresh baseline)
    expect(r.onB.mx, 'B envelope 300').toBe(300);
    expect(r.onB.wcsX, 'B WCS G54 X=99').toBe(99);
    expect(r.onB.auto, 'B autostart BBB').toBe('BBB-boot');
    expect(r.onB.slave, "B has NO gantry slave — the seam did NOT bleed from A").not.toBe('slave');
    // migration: one UNNAMED profile (the user names it); now 2 profiles
    expect(r.migratedName, 'the migrated default is UNNAMED (user names it)').toBe('');
    expect(r.count).toBe(2);
});

test('REAL APP (t684 b): the collapsed PROFILE section + the browser modal — save-as names + lands, load full-swaps', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings && window.ddcsProfileLib);
    await page.evaluate(() => { localStorage.removeItem('ddcs_profile_library'); const s = window.ddcsGetSettings(); s.machine = { x: 700, y: 500, z: 300, show: true }; });
    await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_profile' }));
    await page.waitForSelector('#set_tab_profile #set_profile_saveas', { timeout: 8000 });
    // COLLAPSED structure: a read-only current line + [Save as…] [Profiles…] [Import from dump]. NO inline name/list/new-dup/amber hint.
    const struct = await page.evaluate(() => ({
        current: !!document.getElementById('set_profile_current'),
        saveas: !!document.getElementById('set_profile_saveas'),
        browse: !!document.getElementById('set_profile_browse'),
        dump: !!document.getElementById('set_profile_import_dump'),
        controllerDropdown: !!document.getElementById('set_profile'),
        goneName: !document.getElementById('set_profile_name') && !document.getElementById('set_profile_list') && !document.getElementById('set_profile_new_dup') && !document.getElementById('set_profile_name_hint'),
        sections: [...document.querySelectorAll('#set_tab_profile .settings-section-title')].map((e) => e.textContent),
    }));
    expect(struct.current && struct.saveas && struct.browse && struct.dump, 'collapsed section: current line + Save-as + Profiles… + Import-from-dump').toBe(true);
    expect(struct.goneName, 'the inline name field / list / duplicate / amber hint are GONE (moved to the modal)').toBe(true);
    expect(struct.controllerDropdown, 'the CONTROLLER dropdown stays').toBe(true);
    expect(struct.sections.join(' '), 'PROFILE + CONTROLLER, no POST PROCESSOR').toMatch(/PROFILE/);
    expect(struct.sections.join(' '), 'POST PROCESSOR is gone').not.toMatch(/POST PROCESSOR/);

    // SAVE-AS names the current config (x=700 = "My V4.1 rig") — the ONLY naming moment (dlgPrompt)
    await autoAppDialog(page, { accept: true, prompt: 'My V4.1 rig' });
    await page.click('#set_profile_saveas');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.ddcsProfileLib.activeProfile().name), 'save-as named the current profile').toBe('My V4.1 rig');
    // SAVE-AS again (still x=700) → "Second rig" duplicates the current + becomes active; THEN mutate x on Second rig
    await autoAppDialog(page, { accept: true, prompt: 'Second rig' });
    await page.click('#set_profile_saveas');
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.ddcsGetSettings().machine.x = 320; window.ddcsProfileLib.saveActiveSnapshot(); });
    // BROWSE modal → two rows; loading "My V4.1 rig" FULL-SWAPS the envelope back to 700
    await page.click('#set_profile_browse');
    await page.waitForSelector('.profile-modal');
    expect(await page.locator('.profile-modal .prof-row').count(), 'two profiles in the modal list').toBe(2);
    await page.evaluate(() => { const r = [...document.querySelectorAll('.profile-modal .prof-row')].find((x) => /My V4.1 rig/.test(x.textContent)); r.querySelector('[data-load]').click(); });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.ddcsGetSettings().machine.x), 'loading the first profile full-swaps the envelope back to 700').toBe(700);
    await page.locator('.profile-modal > div').first().screenshot({ path: 'scratchpad/profile-modal.png' });
    // DONE closes
    await page.click('.profile-modal [data-pa="done"]');
    await expect(page.locator('.profile-modal')).toHaveCount(0);

    // the CONTROLLER dropdown still retargets THIS profile + persists
    await page.selectOption('#set_profile', 'ddcs-v41').catch(() => {});
    await page.waitForTimeout(100);
    const persisted = await page.evaluate(() => { const lib = JSON.parse(localStorage.getItem('ddcs_profile_library')); return lib.profiles.find((p) => p.id === lib.activeId).controllerId; });
    expect(persisted, 'changing the CONTROLLER dropdown persists into the active profile').toBe('ddcs-v41');
});

test('duplicate-current seeds a TRUE copy; rename + delete work', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        localStorage.removeItem('ddcs_profile_library');
        const lib = await import('/data/profileLibrary.js');
        const { getSettings } = await import('/ui/settingsPanel.js');
        getSettings().machine = { x: 555, y: 111, z: 222, show: true };
        const aId = lib.getLibrary().activeId; lib.renameProfile(aId, 'Original'); lib.saveActiveSnapshot();
        // duplicate-current → a true copy (same envelope)
        const dupId = lib.createProfile({ from: 'dup', name: 'Copy' });
        const dupEnv = getSettings().machine.x;
        // editing the copy does NOT change the original
        getSettings().machine.x = 999; lib.saveActiveSnapshot();
        lib.switchProfile(aId, true);
        const origEnv = getSettings().machine.x;
        // delete the copy
        const del = lib.deleteProfile(dupId);
        return { dupEnv, origEnv, del, names: lib.listProfiles().map((p) => p.name), count: lib.listProfiles().length };
    });
    expect(r.dupEnv, 'the duplicate copies the current envelope (555)').toBe(555);
    expect(r.origEnv, 'editing the copy did NOT bleed into the original (still 555)').toBe(555);
    expect(r.del, 'delete succeeded').toBe(true);
    expect(r.count, 'back to 1 profile after delete').toBe(1);
    expect(r.names, 'the original survives, named').toContain('Original');
});
