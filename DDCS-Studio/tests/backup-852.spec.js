import { test, expect } from '@playwright/test';

/**
 * t852 — ONE-FILE BACKUP. Export ALL user state → wipe (a fresh context) → restore → every store deep-equals its
 * pre-wipe state (asserted store by store), reusing each store's OWN persisted form (no second serializer). Plus:
 * the preview counts, the pre-restore safety export, older-partial-backup honesty, and the Settings UI + modal.
 */
test.use({ viewport: { width: 1300, height: 980 } });

test('export -> wipe -> restore: every store deep-equals its pre-wipe state; counts + safety + partial honesty', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const backup = await import('/data/backup.js');
        const store = await import('/ui/projects/projectStore.js');
        const uiu = await import('/ui/uiUtils.js');
        uiu.UIUtils.downloadFile = () => {};   // no real file downloads during the test
        window.__ddcsNoReload = true;

        // SEED — write each store's OWN persisted form (localStorage key / the IDB project volume).
        localStorage.setItem('ddcs_studio_settings', JSON.stringify({ machine: { x: 300, y: 300, z: -120 }, atc: { baseVar: 1430, tools: [{ num: 1, name: '6mm Flat', type: 'endmill', dia: 6 }, { num: 2, name: '3mm Ball', type: 'ballnose', dia: 3 }] }, stock: { x: 120, y: 80, z: 20 } }));
        localStorage.setItem('ddcs_profile_library', JSON.stringify({ activeId: 'p1', profiles: [{ id: 'p1', name: 'My Expert', controllerId: 'ddcs_expert' }, { id: 'p2', name: 'Bench', controllerId: 'generic' }] }));
        localStorage.setItem('ddcs_user_ops', JSON.stringify([{ opType: 'user_myop', label: 'My Op', template: [], bindings: [] }]));
        localStorage.setItem('ddcs_tpl_pocket', JSON.stringify([{ name: 'Roughing', params: { depth: 5 } }]));
        localStorage.setItem('ddcs_vars_persistent', JSON.stringify([{ i: 1, t: 'd', d: 0, n: 'X', isSys: true }, { i: 1500, t: 'd', d: 5, n: 'MyVar', isSys: false }]));
        const projObj = { kind: 'ddcs.macro', v: 1, name: 'MyJob', stack: [{ type: 'op', opType: 'user_pocket_data' }] };
        await store.saveProject('MyJob', projObj);

        const read = async () => ({
            settings: JSON.parse(localStorage.getItem('ddcs_studio_settings')),
            profiles: JSON.parse(localStorage.getItem('ddcs_profile_library')),
            userOps: JSON.parse(localStorage.getItem('ddcs_user_ops')),
            presets: JSON.parse(localStorage.getItem('ddcs_tpl_pocket')),
            variables: JSON.parse(localStorage.getItem('ddcs_vars_persistent')),
            project: await store.readProject('MyJob'),
        });
        const before = await read();

        // EXPORT everything.
        const obj = await backup.buildBackup();
        const pv = backup.previewBackup(obj);
        const countOf = (id) => (pv.rows.find((x) => x.id === id) || {}).count;
        const counts = { settings: countOf('settings'), profiles: countOf('profiles'), projects: countOf('projects'), userOps: countOf('userOps'), presets: countOf('presets'), variables: countOf('variables') };

        // SAFETY export of the current state (the undo path) BEFORE the wipe.
        await backup.safetyExport();
        const safety = !!window.__ddcsSafetyExport;

        // WIPE — a fresh context: clear localStorage + the project VFS.
        localStorage.clear();
        await store.remove('MyJob');
        const wipedProject = await store.readProject('MyJob');

        // RESTORE all.
        const res = await backup.restoreBackup(obj);
        const after = await read();

        // OLDER / PARTIAL backup: drop two stores; it should restore only its stores and leave the rest UNTOUCHED.
        const partial = JSON.parse(JSON.stringify(obj)); delete partial.stores.projects; delete partial.stores.userOps;
        const pvPartial = backup.previewBackup(partial);
        localStorage.setItem('ddcs_user_ops', JSON.stringify([{ opType: 'user_keep', label: 'Keep' }]));   // a DIFFERENT current state
        const resPartial = await backup.restoreBackup(partial);
        const userOpsAfterPartial = JSON.parse(localStorage.getItem('ddcs_user_ops'));

        return { before, after, counts, wipedProject, safety, res, pvPartialRows: pvPartial.rows, resPartial, userOpsAfterPartial };
    });

    // DEEP-EQUAL store by store.
    expect(r.after.settings, 'settings round-trip').toEqual(r.before.settings);
    expect(r.after.settings.atc.tools[0].dia, 'the tool dia round-trips (numeric spot-check)').toBe(6);
    expect(r.after.profiles, 'profile library round-trip').toEqual(r.before.profiles);
    expect(r.after.userOps, 'custom wizard round-trip').toEqual(r.before.userOps);
    expect(r.after.presets, 'presets round-trip').toEqual(r.before.presets);
    expect(r.after.variables, 'variables round-trip').toEqual(r.before.variables);
    expect(r.after.project, 'the saved project round-trips').toEqual(r.before.project);
    expect(r.wipedProject, 'the wipe really cleared the project').toBeNull();

    // PREVIEW COUNTS.
    expect(r.counts, 'the per-store preview counts').toEqual({ settings: 2, profiles: 2, projects: 1, userOps: 1, presets: 1, variables: 1 });

    // SAFETY export exists.
    expect(r.safety, 'a pre-restore safety export was produced (the undo path)').toBe(true);
    expect(r.res.restored, 'all seeded stores restored').toEqual(expect.arrayContaining(['settings', 'profiles', 'userOps', 'presets', 'variables', 'projects']));

    // OLDER / PARTIAL backup honesty.
    expect((r.pvPartialRows.find((x) => x.id === 'projects') || {}).present, 'projects absent from the partial backup').toBe(false);
    expect((r.pvPartialRows.find((x) => x.id === 'userOps') || {}).present, 'userOps absent from the partial backup').toBe(false);
    expect(r.resPartial.skipped, 'absent stores are skipped, not restored').toEqual(expect.arrayContaining(['projects', 'userOps']));
    expect(r.userOpsAfterPartial, 'a store absent from the backup is left UNTOUCHED').toEqual([{ opType: 'user_keep', label: 'Keep' }]);
});

test('the Settings Backup tab exposes Export + Restore; the restore modal previews stores in both themes', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openSettings && window.openBackupRestore, null, { timeout: 15000 });

    // Settings → Backup tab (asserted). The panel div is display:none until its tab is selected, so wait for it
    // ATTACHED, then click the tab (via evaluate — works regardless of the active group).
    await page.evaluate(() => window.openSettings());
    await page.waitForSelector('#set_tab_backup', { state: 'attached', timeout: 6000 });
    await page.evaluate(() => { const b = document.querySelector('.settings-tab[data-target="set_tab_backup"]'); if (b) b.click(); });
    await expect(page.locator('#set_backup_export')).toBeVisible();
    await expect(page.locator('#set_backup_restore')).toBeVisible();

    // The restore modal, fed a synthetic backup (skips the file picker) — a NEWER one to also exercise the warning.
    await page.evaluate(async () => {
        window.__ddcsNoReload = true;
        const obj = { kind: 'ddcs.backup', v: 1, app: 'V2026.07.13.10', date: '2026-07-13T00:00:00.000Z', stores: { settings: { atc: { tools: [{ num: 1, dia: 6 }, { num: 2, dia: 3 }] } }, profiles: { profiles: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] }, projects: [{ path: 'A', type: 'project', data: {} }, { path: 'B', type: 'project', data: {} }] } };
        await window.openBackupRestore(obj);
    });
    const ov = page.locator('#backupRestoreOverlay');
    await expect(ov).toBeVisible();
    await expect(ov, 'settings tool count').toContainText('2 tools');
    await expect(ov, 'profiles count').toContainText('3 profiles');
    await expect(ov, 'projects count').toContainText('2 projects');
    await expect(ov, 'absent stores are shown honestly, not omitted').toContainText('not in this backup');

    for (const theme of ['studio', 'futuristic']) {
        await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
        await page.waitForTimeout(90);
        await ov.screenshot({ path: testInfo.outputPath(`backup-restore-${theme}.png`) });
    }
});

test('t1137 workspace: the CAM pack rides inside the .ddcs; Save downloads a .ddcs; the UI reframes to Save/Open workspace', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openSettings, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const backup = await import('/data/backup.js');
        const uiu = await import('/ui/uiUtils.js');
        window.__ddcsNoReload = true;
        let fname = '';
        uiu.UIUtils.downloadFile = (name) => { fname = name; };
        const pack = { meta: { name: 'My Pack', baseSlot: 22 }, slots: [
            { slot: 22, name: 'Pocket', ops: [{ type: 'pocket', variant: 'x', opType: 'pocket' }], body: 'G0\nM30' },
            { slot: 23, name: 'Drill', ops: [{ type: 'drill', variant: 'grid', opType: 'drill' }], body: 'G0\nM30' },
        ] };
        localStorage.setItem('ddcs_campack', JSON.stringify(pack));
        const obj = await backup.buildBackup();
        const row = backup.previewBackup(obj).rows.find((x) => x.id === 'campack');
        await backup.exportEverything();   // → sets fname (the .ddcs)
        localStorage.removeItem('ddcs_campack');
        await backup.restoreBackup(obj);   // open the workspace back
        return { inStores: 'campack' in obj.stores, count: row && row.count, unit: row && row.unit, fname, restored: JSON.parse(localStorage.getItem('ddcs_campack')), orig: pack };
    });
    expect(r.inStores, 'the CAM pack is captured in the workspace').toBe(true);
    expect(r.count, 'the preview counts the CAM slots').toBe(2);
    expect(r.unit).toBe('slots');
    expect(r.fname, 'Save workspace downloads a .ddcs file').toMatch(/\.ddcs$/);
    expect(r.restored, 'the CAM pack round-trips through Save→wipe→Open').toEqual(r.orig);

    // UI reframe: the Workspace tab exposes Save workspace / Open workspace (same button IDs, reframed labels)
    await page.evaluate(() => window.openSettings());
    await page.waitForSelector('#set_tab_backup', { state: 'attached', timeout: 6000 });
    await page.evaluate(() => { const b = document.querySelector('.settings-tab[data-target="set_tab_backup"]'); if (b) b.click(); });
    expect(await page.evaluate(() => document.getElementById('set_backup_export').textContent), 'Export everything → Save workspace').toContain('Save workspace');
    expect(await page.evaluate(() => document.getElementById('set_backup_restore').textContent), 'Restore → Open workspace').toContain('Open workspace');
});
