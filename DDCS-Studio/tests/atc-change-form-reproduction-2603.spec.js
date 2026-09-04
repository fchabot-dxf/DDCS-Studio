import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2603 (BACKLOG #71/#72, Phase 1) migrated atc_change_data onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree — the THIRD op using the `panel:'form3d'` (3D-only,
 * `preview3d` declared alone) shape, after `atc_table_data`/`atc_test_data` proved it against BACKLOG #77's
 * own fix. THE HARDEST of the ATC set per this file's own header (5 routed method arms + a static-arm
 * edit-graft recompose + a declared live-view arm) — none of that complexity is touched by this migration,
 * which only restructures the FORM/uiChildren tree; `children`/the recompose machinery is untouched.
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — same reason as
 * atc_table/atc_test: `#wiz_atc_change` (index.html:996) is a REAL, still-live classic shell, not a retired
 * one. Test 2 is a simplified edit-reaches-model check, not a full `emitEquivalence` sweep across all 5 method
 * arms — already covered by this op's own dedicated `-emit`/`-twin` style spec.
 *
 * EXPECTED_ORDER is ATC_CHANGE_STRUCT_BINDINGS' own array order (one section, "TOOL CHANGE").
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/atcChangeData.js';
const DEF_FACTORY = 'atcChangeDataDef';

const EXPECTED_ORDER = ['_setup', 'method', 'callMacro', 'x', 'y', 'z', 'zClear', 'fixedT', 'orient'];

test('atc-change-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('atc-change-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async (a) => {
    const dd = await import(a.dataModule);
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');

    const def = dd[a.defFactory]();
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

    return { beforeVal: Number(before[a.editParam]), afterVal: Number(after[a.editParam]) };
  }, {
    dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR,
    editParam: 'x', editValue: '150',
  });

  expect(r.beforeVal).toBe(100);   // ATC_CHANGE_DEFAULTS.x
  expect(r.afterVal).toBe(150);
});

test('atc-change-form-reproduction: preview3d alone renders a REAL 3D canvas (BACKLOG #77, fixed)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/atcChangeData.js'); try { U.registerUserOp(M.atcChangeDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_atc_change_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const wizUser = document.getElementById('wiz_user');
    const visible = (sel) => [...(wizUser ? wizUser.querySelectorAll(sel) : [])].some((e) => e.offsetParent !== null);
    return {
      canvasCount: wizUser ? wizUser.querySelectorAll('canvas').length : 0,
      treeBoxVisible: visible('[id$="userVizBox_tree"][data-viz-pane="preview3d"]'),
      has2dPaneVisible: visible('[data-viz-pane="layout2d"]'),
    };
  });
  expect(r.canvasCount, 'a real 3D canvas mounts').toBeGreaterThan(0);
  expect(r.treeBoxVisible, 'the declared tree-mode 3D box is the one actually visible').toBe(true);
  expect(r.has2dPaneVisible, 'NO 2D pane is visible').toBe(false);
});
