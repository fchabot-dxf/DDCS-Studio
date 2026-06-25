import { test, expect } from '@playwright/test';

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
  expect(r.mill0).toEqual(['drill', 'bore', 'pocket', 'contour', 'slot', 'surfacing', 'text']);
  // user op in custom
  expect(r.custom1).toEqual([{ id: 'user_lib_test', label: 'Lib Test', kind: 'user' }]);
  // overrides: pocket hidden + slot moved out of mill; drill renamed; group renamed; slot now in setup; hidden still visible with the flag
  expect(r.mill2).toEqual(['drill', 'bore', 'contour', 'surfacing', 'text']);
  expect(r.millLabel2).toBe('Milling');
  expect(r.drillLabel2).toBe('My Drill');
  expect(r.setupHasSlot).toBe(true);
  expect(r.hiddenPocketShows).toBe(true);
  // .wizard codec round-trips; junk → null
  expect(r.parsed.opType).toBe('user_codec_test');
  expect(r.parsed.label).toBe('Codec Test');
  expect(r.bad).toBe(null);
  // reset restores the shipped catalog but keeps the user op
  expect(r.mill3).toEqual(['drill', 'bore', 'pocket', 'contour', 'slot', 'surfacing', 'text']);
  expect(r.customStill).toBe(1);
});
