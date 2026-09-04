import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2603 (BACKLOG #71/#72, Phase 1) migrated atc_check_data onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree — the FOURTH op using the `panel:'form3d'` (3D-only,
 * `preview3d` declared alone) shape, proved against BACKLOG #77's own fix. UNLIKE atc_change/table/test, this
 * op HAS value bindings (8, `match:{type}`-based, static shape — no superset/guards) — the full two-phase
 * `atcCheckFieldGroups` bootstrap/final pattern applies, same as bore/edge/rotary_*.
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — same reason as
 * the other ATC twins: `#wiz_atc_check` (index.html:915) is a real classic shell this twin isn't wired to open
 * in place of yet. Test 2 is a simplified edit-reaches-model check, not a full `emitEquivalence` sweep —
 * already covered by this op's own dedicated emit test.
 *
 * EXPECTED_ORDER is ATC_CHECK_BINDING_SPECS' own array order, grouped by section: GEOMETRY, TOOL & CUT,
 * TOLERANCE. t2617 (BACKLOG #71/#72) — REORDERED from TOOL & CUT/GEOMETRY/TOLERANCE: out of band against
 * `SECTION_RANK` (`ui/formWidgets.js`; TOLERANCE is unranked, stays last either way), caught by
 * `tests/section-order-parity-2617.spec.js` and confirmed against the real `renderOpForm` (t2613's own
 * measurement) — the section SPLIT itself was already correct, only the group_box order.
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/atcCheckData.js';
const DEF_FACTORY = 'atcCheckDataDef';

const EXPECTED_ORDER = [
  // GEOMETRY
  'blockHeight', 'safeZ',
  // TOOL & CUT
  'maxDist', 'retract', 'f_fast', 'f_slow', 'port',
  // TOLERANCE
  'tolerance',
];

test('atc-check-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('atc-check-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    refStackModule: '/wizards/stacks/atcToolCheckWizard.js', refStackExport: 'atcToolCheckStack',
    dataOptypeExport: 'ATC_CHECK_DATA_OPTYPE', defaultsExport: 'ATC_CHECK_DEFAULTS',
    editParam: 'tolerance', editValue: '0.8',
  });

  expect(r.beforeVal).toBe(0.5);   // ATC_CHECK_DEFAULTS.tolerance
  expect(r.afterVal).toBe(0.8);
  expect(r.eqPass, r.firstDiff ? JSON.stringify(r.firstDiff) : '').toBe(true);
});

test('atc-check-form-reproduction: preview3d alone renders a REAL 3D canvas (BACKLOG #77, fixed)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/atcCheckData.js'); try { U.registerUserOp(M.atcCheckDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_atc_check_data'));
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
