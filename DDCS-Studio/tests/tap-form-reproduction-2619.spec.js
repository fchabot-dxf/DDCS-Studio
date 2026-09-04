import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2619 (BACKLOG #71/#72, conversion tier) converted+migrated tapData.js onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree. tapStack's own flatten is a STATIC tree (its own header
 * comment: `[progstart, wcs, placeonstock{ tap }, progend]`) — every block type appears exactly once, VERIFIED
 * by reading `wizards/stacks/tapWizard.js` directly, not estimated: no `nth` needed anywhere. `blockIndex: 1/2/3`
 * converted to `match:{type:'wcs'|'placeonstock'|'tap'}`. Rule 17 (self-applied): grepped the whole `tests/`
 * directory for `tapData`/`TAP_DATA_OPTYPE`/`user_tap_data` before calling this migration verified.
 *
 * EXPECTED_ORDER declared in the canonical SECTION_RANK order from the start (GEOMETRY/TOOL & CUT — no
 * IDENTITY, per this file's own t2401 comment: tap has no "which variant" selector).
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/tapData.js';
const DEF_FACTORY = 'tapDataDef';

const EXPECTED_ORDER = [
  // GEOMETRY
  'wcs', 'stockAttach', 'pathDatum', 'stockDatum', 'stockW', 'stockH', 'stockZ', 'originX', 'originY', 'offZ', 'x', 'y', 'entryX', 'entryY',
  // TOOL & CUT
  'toolNum', 'pitch', 'depth', 'rpm', 'dwell', 'rigid',
];

test('tap-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async ({ dataModule, defFactory, rowSelector }) => {
    const dd = await import(dataModule);
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const def = dd[defFactory]();
    const binds = formBindings(def);

    const userRoot = def.template.find((b) => b && b.type === 'user_root');
    const tempHost = document.createElement('div');
    const readersFlat = renderOpForm(tempHost, binds) || [];
    const byParam = {};
    tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
      if (!inp || !inp.dataset || !inp.dataset.param) return;
      const row = inp.closest(rowSelector) || inp.parentElement;
      byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const readers = renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);

    const fields = [...host.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
    const orphanCount = readers.orphanCount;
    const explicit = fields.slice(0, fields.length - orphanCount);
    const orphans = fields.slice(fields.length - orphanCount).sort();

    return { fields, explicit, orphans, orphanCount, boundParamCount: Object.keys(byParam).length };
  }, { dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR });

  expect(r.orphanCount).toBe(0);
  expect(r.orphans).toEqual([]);
  expect(r.explicit).toEqual(EXPECTED_ORDER);
  expect(r.fields.length).toBe(r.boundParamCount);
});

test('tap-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async (a) => {
    const dd = await import(a.dataModule);
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const refMod = await import(a.refStackModule);
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');

    const def = dd[a.defFactory]();
    const dataBuilder = builderOf(dd[a.dataOptypeExport]);

    const binds = formBindings(def);
    const userRoot = def.template.find((b) => b && b.type === 'user_root');
    const tempHost = document.createElement('div');
    const readersFlat = renderOpForm(tempHost, binds) || [];
    const byParam = {};
    tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
      if (!inp || !inp.dataset || !inp.dataset.param) return;
      const row = inp.closest(a.rowSelector) || inp.parentElement;
      byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const readers = renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);

    const before = {};
    for (const read of readers) Object.assign(before, read());

    const editInput = host.querySelector(`[data-param="${a.editParam}"]`);
    editInput.value = a.editValue;
    editInput.dispatchEvent(new Event('input', { bubbles: true }));
    editInput.dispatchEvent(new Event('change', { bubbles: true }));

    const after = {};
    for (const read of readers) Object.assign(after, read());

    const emitParams = { ...dd[a.defaultsExport], ...after };
    const eq = emitEquivalence(refMod[a.refStackExport], dataBuilder, [emitParams]);

    return { beforeVal: Number(before[a.editParam]), afterVal: Number(after[a.editParam]), eqPass: eq.pass, firstDiff: eq.firstDiff };
  }, {
    dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR,
    refStackModule: '/wizards/stacks/tapWizard.js', refStackExport: 'tapStack',
    dataOptypeExport: 'TAP_DATA_OPTYPE', defaultsExport: 'TAP_DEFAULTS',
    editParam: 'depth', editValue: '15',
  });

  expect(r.beforeVal).toBe(10);   // TAP_DEFAULTS.depth
  expect(r.afterVal).toBe(15);
  expect(r.eqPass, r.firstDiff ? JSON.stringify(r.firstDiff) : '').toBe(true);
});

test('tap-form-reproduction: the feature canvas mounts a REAL 2D/3D pane, no unwired placeholder', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/tapData.js'); try { U.registerUserOp(M.tapDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_tap_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const wizUser = document.getElementById('wiz_user');
    const visible = (sel) => [...(wizUser ? wizUser.querySelectorAll(sel) : [])].some((e) => e.offsetParent !== null);
    return {
      unwiredPlaceholderCount: wizUser ? wizUser.querySelectorAll('.unwired-block').length : -1,
      has3dPaneVisible: visible('[data-viz-pane="preview3d"]'),
      has2dPaneVisible: visible('[data-viz-pane="layout2d"]'),
      canvasCount: wizUser ? wizUser.querySelectorAll('canvas').length : 0,
    };
  });

  expect(r.unwiredPlaceholderCount, 'no unwired placeholder anywhere').toBe(0);
  expect(r.has3dPaneVisible, 'form3d+2d: the 3D pane is visible').toBe(true);
  expect(r.has2dPaneVisible, 'the 2D layout pane is visible').toBe(true);
  expect(r.canvasCount, 'a real 3D canvas mounts').toBeGreaterThan(0);
});
