import { test, expect } from './support/harness.mjs';

/**
 * The WIZARD LIBRARY — the catalog the wizard bar + the Settings manager render from. Locks: the default catalog
 * (built-in groups/entries), user ops merging into a "Custom" group, the per-entry/per-group OVERRIDES that let a
 * user rename / hide / regroup ANY wizard (built-in included), reset-to-factory, and the portable `.wizard` codec.
 */
test('wizardLibrary: catalog + user ops + overrides + .wizard codec', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const L = await import('/blocks/wizardLibrary.js');
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    localStorage.removeItem('ddcs_wizard_layout');
    const ids = (lib, g) => ((lib.groups.find((x) => x.id === g) || {}).items || []).map((i) => i.id);
    const grp = (lib, g) => lib.groups.find((x) => x.id === g) || {};

    // 1. default catalog
    const lib0 = L.getLibrary();
    const groups0 = lib0.groups.map((g) => g.id);
    const mill0 = ids(lib0, 'mill');

    // 2. a user op joins the "custom" group
    L.createWizard(U.userOpFromStack('lib_test', 'Lib Test',
      [{ type: 'move', params: { x: 0, y: 0, z: -5 } }],
      [{ param: 'depth', blockIndex: 0, key: 'z', type: 'number', default: -5 }]));
    const lib1 = L.getLibrary();
    const custom1 = (grp(lib1, 'custom').items || []).map((i) => ({ id: i.id, label: i.label, kind: i.kind }));

    // 3. overrides: hide pocket, rename drill, move slot → setup, rename the mill group
    L.setEntryOverride('pocket', { visible: false });
    L.setEntryOverride('drill', { label: 'My Drill' });
    L.setEntryOverride('slot', { group: 'setup' });
    L.setGroupOverride('mill', { label: 'Milling' });
    const lib2 = L.getLibrary();
    const mill2 = ids(lib2, 'mill');
    const millLabel2 = grp(lib2, 'mill').label;
    const drillLabel2 = (grp(lib2, 'mill').items.find((i) => i.id === 'drill') || {}).label;
    const setupHasSlot = ids(lib2, 'setup').includes('slot');
    const hiddenPocketShows = L.getLibrary({ includeHidden: true }).groups.find((g) => g.id === 'mill').items.some((i) => i.id === 'pocket');

    // 4. .wizard codec
    const def = U.userOpFromStack('codec_test', 'Codec Test',
      [{ type: 'move', params: { z: -3 } }], [{ param: 'd', blockIndex: 0, key: 'z', type: 'number', default: -3 }]);
    const file = L.wizardToFile(def);
    const parsed = L.wizardFromFile(file);
    const bad = L.wizardFromFile('{"kind":"not-a-wizard"}');

    // 5. reset clears the bar customization (but keeps user ops)
    L.resetLayout();
    const lib3 = L.getLibrary();
    const mill3 = ids(lib3, 'mill');
    const customStill = (grp(lib3, 'custom').items || []).length;

    localStorage.removeItem('ddcs_user_ops');
    localStorage.removeItem('ddcs_wizard_layout');
    return { groups0, mill0, custom1, mill2, millLabel2, drillLabel2, setupHasSlot, hiddenPocketShows, parsed, bad, mill3, customStill };
  });

  // default catalog
  expect(r.groups0).toEqual(['setup', 'probe', 'atc', 'mill']);
  expect(r.mill0).toEqual(['drill', 'bore', 'pocket', 'contour', 'slot', 'surfacing', 'text', 'tap']);   // t778 — the new Tapping wizard
  // user op in custom
  expect(r.custom1).toEqual([{ id: 'user_lib_test', label: 'Lib Test', kind: 'user' }]);
  // overrides: pocket hidden + slot moved out of mill; drill renamed; group renamed; slot now in setup; hidden still visible with the flag
  expect(r.mill2).toEqual(['drill', 'bore', 'contour', 'surfacing', 'text', 'tap']);   // t778 — tap stays after pocket/slot are hidden/moved
  expect(r.millLabel2).toBe('Milling');
  expect(r.drillLabel2).toBe('My Drill');
  expect(r.setupHasSlot).toBe(true);
  expect(r.hiddenPocketShows).toBe(true);
  // .wizard codec round-trips; junk → null
  expect(r.parsed.opType).toBe('user_codec_test');
  expect(r.parsed.label).toBe('Codec Test');
  expect(r.bad).toBe(null);
  // reset restores the shipped catalog but keeps the user op
  expect(r.mill3).toEqual(['drill', 'bore', 'pocket', 'contour', 'slot', 'surfacing', 'text', 'tap']);   // t778 — reset restores the shipped catalog incl. tap
  expect(r.customStill).toBe(1);
});

test('wizardLibrary: .wizard export/import carries panel + declared sim intent', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const L = await import('/blocks/wizardLibrary.js');
    const U = await import('/blocks/userOps.js');
    const sim = await import('/viz/opSimContext.js');
    localStorage.removeItem('ddcs_user_ops');
    localStorage.removeItem('ddcs_wizard_layout');

    // a wizard with a 2D panel + a DECLARED rotary rig (the a:45 move is irrelevant — intent is declared, not inferred)
    L.createWizard(U.userOpFromStack('share_test', 'Share Test',
      [{ type: 'move', params: { mode: 'rapid', a: 45 } }], [], 'form2d', { showRotaryRig: true }));
    const file = L.exportWizard('user_share_test');
    const parsed = JSON.parse(file).op;

    // simulate a clean machine: drop the wizard + its live intent, then import the shared file
    L.deleteWizard('user_share_test');
    const afterDelete = sim.opSimContext('user_share_test').showRotaryRig;
    L.importWizard(file);
    const reDef = U.listUserOps().find((d) => d.opType === 'user_share_test');
    const ctx = sim.opSimContext('user_share_test');

    localStorage.removeItem('ddcs_user_ops');
    localStorage.removeItem('ddcs_wizard_layout');
    return { filePanel: parsed.panel, fileSim: parsed.sim, afterDelete, panel: reDef && reDef.panel, simDef: reDef && reDef.sim, ctxRig: ctx.showRotaryRig };
  });

  expect(r.filePanel, '.wizard file carries the panel type').toBe('form2d');
  expect(r.fileSim, '.wizard file carries the declared sim intent').toMatchObject({ showRotaryRig: true });
  expect(r.afterDelete, 'deleting cleared the live intent').toBe(false);
  expect(r.panel, 'imported wizard keeps its panel').toBe('form2d');
  expect(r.simDef, 'imported wizard keeps its sim intent').toMatchObject({ showRotaryRig: true });
  expect(r.ctxRig, 'imported wizard re-declares the rotary rig').toBe(true);
});

test('wizardLibrary: sections + create / delete custom dropdowns', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const L = await import('/blocks/wizardLibrary.js');
    localStorage.removeItem('ddcs_user_ops');
    localStorage.removeItem('ddcs_wizard_layout');
    const sectionOf = (lib, id) => (lib.groups.find((g) => g.id === id) || {}).section;
    const ids = (lib, id) => ((lib.groups.find((g) => g.id === id) || {}).items || []).map((i) => i.id);

    // default sections: setup→left, the rest→center
    const lib0 = L.getLibrary();
    const sections0 = { setup: sectionOf(lib0, 'setup'), probe: sectionOf(lib0, 'probe'), mill: sectionOf(lib0, 'mill') };

    // create a dropdown in the RIGHT section; empty = hidden from the bar, shown in the manager
    const gid = L.createGroup('My Probes', 'right');
    const emptyInBar = L.getLibrary().groups.some((g) => g.id === gid);
    const emptyInMgr = L.getLibrary({ includeHidden: true, includeEmpty: true }).groups.some((g) => g.id === gid);

    // move a wizard into it
    L.setEntryOverride('edge', { group: gid });
    const g1 = L.getLibrary().groups.find((g) => g.id === gid);
    const probeLostEdge = !ids(L.getLibrary(), 'probe').includes('edge');

    // delete it → its wizard reverts to the default dropdown (probe)
    L.deleteGroup(gid);
    const lib2 = L.getLibrary();
    const gone = !lib2.groups.some((g) => g.id === gid);
    const edgeBackInProbe = ids(lib2, 'probe').includes('edge');

    // shipped dropdowns can't be deleted
    L.deleteGroup('probe');
    const probeSurvives = L.getLibrary().groups.some((g) => g.id === 'probe');

    // reset clears custom dropdowns too
    const gid2 = L.createGroup('Temp', 'left');
    const afterReset = (L.resetLayout(), L.getLibrary({ includeHidden: true, includeEmpty: true }).groups.some((g) => g.id === gid2));

    localStorage.removeItem('ddcs_wizard_layout');
    return { sections0, emptyInBar, emptyInMgr, g1section: g1 && g1.section, g1custom: g1 && g1.custom, g1items: g1 && g1.items.map((i) => i.id), probeLostEdge, gone, edgeBackInProbe, probeSurvives, afterReset };
  });

  expect(r.sections0).toEqual({ setup: 'left', probe: 'center', mill: 'center' });
  expect(r.emptyInBar, 'empty new dropdown hidden from the bar').toBe(false);
  expect(r.emptyInMgr, 'empty new dropdown shows in the manager').toBe(true);
  expect(r.g1section).toBe('right');
  expect(r.g1custom).toBe(true);
  expect(r.g1items).toEqual(['edge']);
  expect(r.probeLostEdge).toBe(true);
  expect(r.gone, 'deleted dropdown is gone').toBe(true);
  expect(r.edgeBackInProbe, 'its wizard reverted to its default dropdown').toBe(true);
  expect(r.probeSurvives, 'shipped dropdowns are undeletable').toBe(true);
  expect(r.afterReset, 'reset clears custom dropdowns').toBe(false);
});
