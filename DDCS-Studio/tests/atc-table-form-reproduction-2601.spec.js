import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2601/t2603 (BACKLOG #71/#72, Phase 1) migrated atc_table_data onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree — the FIRST op in this arc whose panel is 3D-ONLY
 * (`'form3d'`, no `+2d`): `preview3d` is declared ALONE in the RIGHT pane, no adjacent `feature_canvas`
 * sibling. This exercises `formWidgets.js`'s own `buildVizBox(container, false)` fallback branch, which t2601
 * found MOUNTED ZERO CANVASES (a real mechanism gap, BACKLOG #77) and t2603 FIXED: the branch now builds the
 * SAME logical box name (`userVizBox`/`userVizContainer`) `userOpView.js`'s own single-panel `'3d'`-mode branch
 * already mounts into, rather than `userViz3dBox`/`userViz3dContainer` (a name that branch never looked up).
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — this op is
 * DIFFERENT from every other shell-less twin migrated so far: `#wiz_atc_table` (index.html:967) is a REAL,
 * still-live classic shell (atcViews.js's own panel class), not a retired one — this twin is simply not yet
 * wired to open in its place (`opensAs`, still E2). The shared suite's own shell-parity test would compare
 * against that UNRELATED, separate rendering code path, not this twin's own generic userOpView — so it would
 * be comparing two different things, not proving the twin reproduces itself. Test 2 below is a simplified
 * edit-reaches-model check (not a full `emitEquivalence` sweep) — atc_table's own emit unrolls from LIVE
 * `settings.atc.tools/magazine` (a declared live-view, same complexity class as homing), already covered by
 * `atc-table-twin.spec.js`/`atc-table-superset.spec.js`.
 *
 * EXPECTED_ORDER is ATC_TABLE_STRUCT_BINDINGS' own array order (one section, "TOOL TABLE → CONTROLLER").
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/atcTableData.js';
const DEF_FACTORY = 'atcTableDataDef';

const EXPECTED_ORDER = ['includeLengths', 'includePockets', '_setup'];

test('atc-table-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('atc-table-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    editInput.checked = false;
    editInput.dispatchEvent(new Event('change', { bubbles: true }));

    const after = {};
    for (const read of readers) Object.assign(after, read());

    return { beforeVal: !!before[a.editParam], afterVal: !!after[a.editParam] };
  }, {
    dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR,
    editParam: 'includePockets',
  });

  expect(r.beforeVal).toBe(true);   // ATC_TABLE_DEFAULTS.includePockets
  expect(r.afterVal).toBe(false);
});

test('atc-table-form-reproduction: preview3d alone renders a REAL 3D canvas (BACKLOG #77, fixed)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/atcTableData.js'); try { U.registerUserOp(M.atcTableDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_atc_table_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);

  // scoped to #wiz_user — the page also carries OTHER, unrelated viz-pane instances (menu mini-previews etc.)
  // that are NOT descendants of #wiz_user. AND checked by VISIBILITY, not mere DOM presence: #wiz_user's own
  // classic/flat shell markup permanently carries BOTH a preview3d and a layout2d pane as static HTML (t2323 —
  // render()'s own isTree branch HIDES, not removes, the shell's native pane when tree mode takes over) — the
  // real claim is that the declared tree-mode box (id ending `_tree`) is the one actually VISIBLE, and that no
  // VISIBLE 2D pane exists, not that a hidden classic 2D pane's own static markup is absent from the DOM.
  const r = await page.evaluate(() => {
    const wizUser = document.getElementById('wiz_user');
    // offsetParent !== null (not getComputedStyle(e).display, which only reports the ELEMENT's own CSS
    // property and ignores an ancestor's display:none collapsing the whole subtree — a real gotcha caught
    // live here: the classic pane's own element reports display:flex while its ancestor .wiz-visual is
    // display:none, so it never actually paints).
    const visible = (sel) => [...(wizUser ? wizUser.querySelectorAll(sel) : [])].some((e) => e.offsetParent !== null);
    return {
      canvasCount: wizUser ? wizUser.querySelectorAll('canvas').length : 0,
      treeBoxVisible: visible('[id$="userVizBox_tree"][data-viz-pane="preview3d"]'),
      has2dPaneVisible: visible('[data-viz-pane="layout2d"]'),
    };
  });
  expect(r.canvasCount, 'a real 3D canvas mounts (BACKLOG #77 was: zero canvases mounted at all)').toBeGreaterThan(0);
  expect(r.treeBoxVisible, 'the declared tree-mode 3D box (userVizBox_tree) is the one actually visible').toBe(true);
  expect(r.has2dPaneVisible, 'NO 2D pane is VISIBLE (panel=form3d, preview3d declared alone) — the classic shell\'s own static 2D pane stays hidden').toBe(false);
});
