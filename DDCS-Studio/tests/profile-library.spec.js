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

test('REAL APP: the profile-first Controller panel — name, new dup, switch swaps the envelope, override banner; screenshots', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings && window.ddcsProfileLib);
    await page.evaluate(() => { localStorage.removeItem('ddcs_profile_library'); const s = window.ddcsGetSettings(); s.machine = { x: 700, y: 500, z: 300, show: true }; });
    await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_profile' }));
    await page.waitForSelector('#set_tab_profile #set_profile_name', { timeout: 8000 });
    // profile-first structure (the amended labels): section 1 PROFILE (name + list + New/Duplicate + Export), section 2
    // CONTROLLER (ONE dropdown). NO post-override banner/advanced (dropped). The migrated profile is UNNAMED → a prompt.
    const struct = await page.evaluate(() => {
        const sec = [...document.querySelectorAll('#set_tab_profile .settings-section-title')].map((e) => e.textContent);
        return {
            nameField: !!document.getElementById('set_profile_name'),
            controllerDropdown: !!document.getElementById('set_profile'),
            list: !!document.getElementById('set_profile_list'),
            newDup: !!document.getElementById('set_profile_new_dup') && !!document.getElementById('set_profile_new_base'),
            noBanner: !document.getElementById('set_post_override_banner') && !document.getElementById('set_post_advanced') && !document.getElementById('set_post'),
            sections: sec,
            unnamedHint: (document.getElementById('set_profile_name_hint') || {}).textContent || '',
        };
    });
    expect(struct.nameField && struct.controllerDropdown && struct.list && struct.newDup, 'profile-first panel structure').toBe(true);
    expect(struct.noBanner, 'the post-override banner + advanced link + post dropdown are dropped (amend 2)').toBe(true);
    expect(struct.sections, 'sections renamed: PROFILE + CONTROLLER (no POST PROCESSOR)').toContain('PROFILE');
    expect(struct.sections, 'the CONTROLLER section (was POST PROCESSOR)').toContain('CONTROLLER');
    expect(struct.sections.join(' '), 'POST PROCESSOR is gone').not.toMatch(/POST PROCESSOR/);
    expect(struct.unnamedHint, 'the migrated profile prompts to be named (non-blocking-persistent)').toMatch(/Name your machine config/i);

    // name the migrated (unnamed) profile
    await page.fill('#set_profile_name', 'My V4.1 rig');
    await page.dispatchEvent('#set_profile_name', 'change');
    // create a 2nd profile (duplicate current) — accept the name prompt (profiles are only ever user-named)
    await autoAppDialog(page, { accept: true, prompt: 'Second rig' });
    await page.click('#set_profile_new_dup');
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.ddcsGetSettings().machine.x = 320; window.ddcsProfileLib.saveActiveSnapshot(); });
    const rowCount = await page.evaluate(() => document.querySelectorAll('#set_profile_list .prof-row').length);
    expect(rowCount, 'two profiles in the list').toBe(2);
    // switch back to the first via the list → the envelope swaps to 700
    await page.evaluate(() => { const rows = [...document.querySelectorAll('#set_profile_list .prof-row')]; const first = rows.find((r) => /My V4.1 rig/.test(r.textContent)); first.click(); });
    await page.waitForTimeout(150);
    const env1 = await page.evaluate(() => window.ddcsGetSettings().machine.x);
    expect(env1, 'switching to the first profile swaps the envelope back to 700').toBe(700);
    await page.locator('#set_tab_profile').screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad/profile-first-panel.png' });

    // the CONTROLLER dropdown is the single authoritative control: changing it retargets THIS profile + persists (reload → stuck)
    await page.selectOption('#set_profile', 'ddcs-v41').catch(() => {});
    await page.waitForTimeout(100);
    const persisted = await page.evaluate(() => {
        const lib = JSON.parse(localStorage.getItem('ddcs_profile_library'));
        const active = lib.profiles.find((p) => p.id === lib.activeId);
        return active.controllerId;
    });
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
