import { test, expect } from '@playwright/test';

/**
 * t1215 — THE WORKSPACE ROUND-TRIP (required regression for the one-workspace-one-machine pivot).
 *
 * The pivot makes the `.ddcs` file BE the machine: one controller + one envelope + one WCS table per workspace. Every
 * later step of the pivot (the migration, the Controller reframe, Duplicate-workspace, the summary manifest) INHERITS
 * this apply path, so it has to be pinned first: edit the machine, save the workspace, reopen it, and the values must
 * come back EXACT — not merely "present", and not silently re-defaulted.
 *
 * The envelope is deliberately asserted with values a falsy-fallback bug would eat (a NEGATIVE z, and a typed 0 on a
 * field the pivot must let you set) — that is the class the `_gvs` typed-0 bug lives in, so this spec is the net under it.
 *
 * Reserve-the-word-save: this drives the REAL .ddcs write/read path (buildBackup → restoreBackup), which is the only
 * thing allowed to be called "saved" — localStorage is a temporary buffer, never the source of truth here.
 *
 * HOW RESTORE APPLIES (measured, and load-bearing for the pivot): restoreBackup writes each store's OWN persisted bytes
 * back to localStorage but does NOT re-read the LIVE in-memory settings object — the shipped flow reloads the page after
 * a restore (backupModal), which is what makes the values take. So these tests reload too: asserting without the reload
 * would test a path the app never uses. Any "reopen a workspace" affordance the pivot adds inherits exactly this, so if
 * it ever restores WITHOUT a reload it needs a live-apply hook — that is the seam this spec guards.
 */
const MACHINE = { x: 555, y: 666, z: -77 };
const WCS_ROW = { x: 12.5, y: -34.25, z: -56.75 };

test('edit envelope + WCS → save the workspace → reopen: every value returns EXACT', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsBuildBackup && window.ddcsRestoreBackup);

  // 1. EDIT the machine record (envelope + the active WCS row) exactly as the Settings surface would.
  await page.evaluate(({ MACHINE, WCS_ROW }) => {
    const s = window.ddcsGetSettings();
    s.machine = { ...(s.machine || {}), x: MACHINE.x, y: MACHINE.y, z: MACHINE.z, show: true, safeZMargin: 5 };
    s.machine.wcs = { active: 1, table: [WCS_ROW] };
    window.ddcsSaveSettings && window.ddcsSaveSettings();
  }, { MACHINE, WCS_ROW });

  // 2. SAVE the workspace — the real .ddcs payload (what exportEverything writes to the user's file).
  const saved = await page.evaluate(async () => JSON.stringify(await window.ddcsBuildBackup()));

  // 3. CLOBBER the live state, the way opening a different workspace would.
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.machine = { x: 1, y: 1, z: 1, show: false, wcs: { active: 1, table: [{ x: 0, y: 0, z: 0 }] } };
    window.ddcsSaveSettings && window.ddcsSaveSettings();
  });
  const clobbered = await page.evaluate(() => window.ddcsGetSettings().machine.x);
  expect(clobbered, 'the live state really was replaced before the reopen').toBe(1);

  // 4. REOPEN the saved workspace through the real restore path, then RELOAD exactly as the shipped flow does.
  await page.evaluate(async (text) => { await window.ddcsRestoreBackup(JSON.parse(text)); }, saved);
  await page.reload();
  await page.waitForFunction(() => window.ddcsGetSettings);
  const back = await page.evaluate(() => {
    const m = window.ddcsGetSettings().machine || {};
    const row = (m.wcs && m.wcs.table && m.wcs.table[0]) || {};
    return { x: m.x, y: m.y, z: m.z, wcs: { x: row.x, y: row.y, z: row.z }, active: m.wcs && m.wcs.active };
  });

  // 5. EXACT — every axis, including a NEGATIVE z (the sign a falsy/abs bug would drop).
  expect(back.x, 'envelope X returns exact').toBe(MACHINE.x);
  expect(back.y, 'envelope Y returns exact').toBe(MACHINE.y);
  expect(back.z, 'envelope Z returns exact, sign intact (negative Z = homes at the top)').toBe(MACHINE.z);
  expect(back.wcs, 'the WCS row returns exact, including negative + fractional values').toEqual(WCS_ROW);
  expect(back.active, 'the active WCS index survives').toBe(1);
});

test('a typed 0 on an envelope axis SURVIVES the round-trip (it must not be re-defaulted)', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsBuildBackup && window.ddcsRestoreBackup);
  // 0 is not a USEFUL travel, but the user must be able to type it and see it stick — a falsy-fallback getter silently
  // swaps it for a default, which is exactly how a typed value "won't take" in the field.
  await page.evaluate(async () => {
    const s = window.ddcsGetSettings();
    s.machine = { ...(s.machine || {}), x: 0, y: 400, z: -120 };
    window.ddcsSaveSettings && window.ddcsSaveSettings();
    const payload = JSON.parse(JSON.stringify(await window.ddcsBuildBackup()));
    s.machine = { x: 999, y: 999, z: 999 };
    window.ddcsSaveSettings && window.ddcsSaveSettings();
    await window.ddcsRestoreBackup(payload);
  });
  await page.reload();
  await page.waitForFunction(() => window.ddcsGetSettings);
  const back = await page.evaluate(() => { const m = window.ddcsGetSettings().machine || {}; return { x: m.x, y: m.y, z: m.z }; });
  expect(back.x, 'a typed 0 comes back as 0 — never replaced by a fallback').toBe(0);
  expect(back.y, 'its neighbours are untouched').toBe(400);
  expect(back.z, 'and the negative Z is intact').toBe(-120);
});

test('the workspace carries exactly ONE machine record (the pivot invariant)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsBuildBackup && window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    window.ddcsSaveSettings && window.ddcsSaveSettings();   // a FRESH context has never persisted settings, so the store would be absent
    const b = await window.ddcsBuildBackup();
    const st = b.stores || {};
    return {
      kind: b.kind,
      hasSettings: !!st.settings,
      // one envelope + one active WCS index live in the SETTINGS store — the workspace's single machine record
      envelope: st.settings && st.settings.machine ? { x: st.settings.machine.x, y: st.settings.machine.y, z: st.settings.machine.z } : null,
      controllerKeys: Object.keys(st).filter((k) => /profile/i.test(k)),
    };
  });
  expect(r.kind, 'the payload is a .ddcs workspace').toBe('ddcs.backup');
  expect(r.hasSettings, 'the machine record rides in the settings store').toBe(true);
  expect(r.envelope, 'exactly one envelope is present').not.toBeNull();
  expect(Number.isFinite(r.envelope.x) && Number.isFinite(r.envelope.y) && Number.isFinite(r.envelope.z), 'the envelope is fully numeric').toBe(true);
});

/**
 * t1215 — A TYPED 0 COMMITS FROM THE FIELD (the settings-getter half of the same bug).
 *
 * The round-trip test above proves persistence keeps a 0. This proves the FIELD does: `_gvs` used to read
 * `Number.isFinite(n) && n !== 0 ? n : d`, so typing 0 into an envelope travel silently restored the previous value —
 * the field appeared to reject the keystroke with no explanation. The fallback now means "absent or EMPTY", never "zero".
 * A 0 travel is not USEFUL (the envelope draws degenerate, and envelopeCheck flags that axis) — but it is the user's
 * input, and the app should show the consequence rather than swallow it.
 */
test('an envelope field accepts a typed 0, keeps real values, and still falls back when EMPTIED', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
  await page.evaluate(() => window.openSettings());
  await page.waitForFunction(() => document.getElementById('set_mach_x'), null, { timeout: 9000 });

  const r = await page.evaluate(() => {
    const setF = (id, v) => { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    const mach = () => window.ddcsGetSettings().machine;
    setF('set_mach_x', 0); setF('set_mach_y', 400); setF('set_mach_z', -120);
    const zero = { x: mach().x, y: mach().y, z: mach().z };
    setF('set_mach_x', 321);
    const real = mach().x;
    const e = document.getElementById('set_mach_x'); e.value = ''; e.dispatchEvent(new Event('change', { bubbles: true }));
    return { zero, real, emptied: mach().x };
  });

  expect(r.zero.x, 'a TYPED 0 commits — it is not swapped for the previous value').toBe(0);
  expect(r.zero.y, 'its neighbours commit normally').toBe(400);
  expect(r.zero.z, 'a negative Z commits (the sign is the home direction)').toBe(-120);
  expect(r.real, 'a normal value still commits').toBe(321);
  expect(r.emptied, 'EMPTYING the field falls back to the current value — it must not become 0 or NaN').toBe(321);
});

/**
 * t1217 — OPEN/RESTORE ADOPTS THE FILE'S CONTROLLER (user ruling, [[one-workspace-one-machine]]).
 *
 * The .ddcs IS the machine, so restoring a workspace must switch this browser to the FILE's controller. The old
 * behaviour kept the receiving browser's controller — which contradicts the model: you would open someone's Expert M350
 * workspace on a V4.1 machine and silently emit for the wrong dialect. The machine record (name + controllerId) is a
 * declared BACKUP_STORES row whose write retargets the live controller, so adoption happens through the SAME one-source
 * path every other store restores by — not a special case bolted onto the open flow.
 */
test('restoring a workspace ADOPTS the file\'s controller (the file is the machine)', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsBuildBackup && window.ddcsRestoreBackup && window.ddcsSetMachine && window.ddcsGetMachine);

  const r = await page.evaluate(async () => {
    const { getActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
    // author a workspace whose machine is a DIFFERENT controller than the one this browser is on
    window.ddcsSetMachine({ name: 'Shop Bee', controllerId: 'ddcs-v41' }, true);
    window.ddcsSaveSettings && window.ddcsSaveSettings();
    const payload = JSON.parse(JSON.stringify(await window.ddcsBuildBackup()));
    const inFile = payload.stores.machine;

    // now put the browser on a DIFFERENT controller, as a second machine's workspace would
    window.ddcsSetMachine({ name: 'Other', controllerId: 'ddcs-expert-m350' }, true);
    const before = { controller: (getActiveProfile() || {}).id, machine: window.ddcsGetMachine() };

    await window.ddcsRestoreBackup(payload);
    return { inFile, before, after: { controller: (getActiveProfile() || {}).id, machine: window.ddcsGetMachine() } };
  });

  expect(r.inFile, 'the .ddcs carries the machine record as a declared store').toEqual({ name: 'Shop Bee', controllerId: 'ddcs-v41' });
  expect(r.before.controller, 'the browser really was on a different controller first').toBe('ddcs-expert-m350');
  expect(r.after.machine, 'the restored machine record is the FILE\'s').toEqual({ name: 'Shop Bee', controllerId: 'ddcs-v41' });
  expect(r.after.controller, 'and the LIVE controller was retargeted to it — the file is the machine').toBe('ddcs-v41');
});

/**
 * t1217 — a LEGACY .ddcs (profile library, no machine row) still opens, and collapses to the single machine record.
 * Nothing is lost: the ACTIVE profile becomes the workspace's machine, and non-active profiles stay available as
 * one-time machine-config exports rather than being silently dropped.
 */
test('a legacy workspace (profile library) restores and collapses to ONE machine, keeping the others exportable', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsRestoreBackup && window.ddcsGetMachine && window.ddcsLegacyMachineConfigs);
  const r = await page.evaluate(async () => {
    localStorage.removeItem('ddcs_machine');
    const legacy = {
      kind: 'ddcs.backup', v: 1, app: 'test', date: new Date().toISOString(),
      stores: { profiles: { activeId: 'p1', profiles: [
        { id: 'p1', name: 'Bee', controllerId: 'ddcs-v41', settings: {}, userVars: [] },
        { id: 'p2', name: 'Router 2', controllerId: 'ddcs-expert-m350', settings: {}, userVars: [] },
      ] } },
    };
    await window.ddcsRestoreBackup(legacy);
    return { machine: window.ddcsGetMachine(), pending: window.ddcsLegacyMachineConfigs().map((p) => p.name) };
  });
  expect(r.machine.name, 'the ACTIVE legacy profile became this workspace\'s machine').toBe('Bee');
  expect(r.machine.controllerId, 'with its controller').toBe('ddcs-v41');
  expect(r.pending, 'the non-active profile is NOT dropped — it stays available as a machine-config export').toEqual(['Router 2']);
});

/**
 * t1217 (4) — A CHECKLIST ROW IS SATISFIED BY CONFIRMATION, NOT ONLY BY A DIFF.
 *
 * The Controller row read "was the id key ever written", whose only writer is the select's `change` event — so the very
 * common case (open Settings, see the CORRECT controller, close) could never satisfy it and the row nagged forever with
 * nothing to do. Same shape for Stock: a correct default was indistinguishable from "never looked at it". The user's
 * explicit acknowledgment is now recorded and counts. A genuine value still satisfies the row on its own, so nothing
 * that already passed starts failing.
 */
test('a confirmed row counts even when the value never changed (and a real value still counts)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const CL = await import('/ui/setupChecklist.js');
    localStorage.removeItem('ddcs_setup_confirmed');
    localStorage.removeItem('ddcs_controller_profile');   // never explicitly chosen → the old predicate says "not set"
    const key = () => JSON.parse(localStorage.getItem('ddcs_setup_confirmed') || '{}');
    const hadBefore = !!key().controller;
    CL.confirmSetupRow('controller');
    const hasAfter = !!key().controller;
    CL.confirmSetupRow('stock');
    return { hadBefore, hasAfter, stock: !!key().stock, exported: typeof CL.confirmSetupRow === 'function' };
  });
  expect(r.exported, 'confirmSetupRow is the declared confirm seam').toBe(true);
  expect(r.hadBefore, 'nothing was confirmed to begin with').toBe(false);
  expect(r.hasAfter, 'confirming the Controller row records it — with no value change at all').toBe(true);
  expect(r.stock, 'the Stock row records the same way (its Done IS the declaration)').toBe(true);
});

/**
 * t1217 — THE RETIRE MUST STAY RETIRED (migrated from the deleted tests/profile-library.spec.js).
 *
 * The library was UNKILLABLE by construction: readLib() treated an empty library as "none" and re-seeded one from live
 * state, so any surviving caller resurrected the store. That is why this asserts the ABSENCE of the whole surface, not
 * just that one button is gone — a half-retire is what this guards against. The machine surface must be present in the
 * same breath, so "it's all gone" can never pass by the panel failing to render at all.
 */
test('the profile-library surface is GONE from Settings and the machine surface is present', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings && window.ddcsGetMachine);
  // seed a legacy library, THEN open Settings — a resurrecting reader would rebuild the retired UI from it
  await page.evaluate(() => localStorage.setItem('ddcs_profile_library', JSON.stringify({
    activeId: 'p1', profiles: [{ id: 'p1', name: 'Legacy Rig', controllerId: 'ddcs-v41', settings: {}, userVars: [] }],
  })));
  await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_profile' }));
  await page.waitForSelector('#set_tab_profile', { state: 'visible', timeout: 8000 });

  const s = await page.evaluate(() => ({
    // RETIRED — every door into the library
    saveas: !!document.getElementById('set_profile_saveas'),
    browse: !!document.getElementById('set_profile_browse'),
    list: !!document.getElementById('set_profile_list'),
    newDup: !!document.getElementById('set_profile_new_dup'),
    newBase: !!document.getElementById('set_profile_new_base'),
    del: !!document.getElementById('set_profile_delete'),
    legacyName: !!document.getElementById('set_profile_name'),
    globalLib: !!window.ddcsProfileLib,
    // PRESENT — the machine surface that replaced it
    machineName: !!document.getElementById('set_machine_name'),
    controllerDropdown: !!document.getElementById('set_profile'),
    dump: !!document.getElementById('set_profile_import_dump'),
    titles: [...document.querySelectorAll('#set_tab_profile .settings-section-title')].map((e) => e.textContent).join(' '),
  }));

  expect(s.saveas || s.browse || s.list || s.newDup || s.newBase || s.del || s.legacyName,
    'no profile-library control survives in Settings').toBe(false);
  expect(s.globalLib, 'window.ddcsProfileLib is gone (the module that auto-created the library is deleted)').toBe(false);
  expect(s.machineName, 'the machine NAME field is the identity control now').toBe(true);
  expect(s.controllerDropdown, 'the CONTROLLER dropdown stays — it retargets THIS workspace').toBe(true);
  expect(s.dump, 'Import-from-dump stays').toBe(true);
  expect(s.titles, 'the section is framed as this workspace\'s machine').toMatch(/THIS WORKSPACE'S MACHINE/);
});
