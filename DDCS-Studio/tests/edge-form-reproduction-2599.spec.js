import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2599 (BACKLOG #71/#72, Phase 1) migrated edge_data onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree (mirroring drill/surfacing/bore/rotary_clock/alignment).
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — same reason as
 * bore/rotary_clock/alignment's own standalone specs: its own "test 2" assumes a REAL, dedicated classic shell
 * page. Edge has none — `#wiz_edge` was RETIRED at t1730 (index.html:347). Same `.wiz-usage` collision. Tests 1
 * and 2 below are copied directly from `formReproduction.js`'s own test 1/test 3 (unmodified logic).
 *
 * EXPECTED_ORDER is edgeData.js's own declared TOOL & CUT/IDENTITY/GEOMETRY split (see `edgeFieldGroups`) — edge
 * is the FIRST migrated op with THREE sections rather than two: the pre-t2599 flat array had all 6 value
 * bindings (TOOL & CUT) first, then axis/dir (IDENTITY), then wcs (GEOMETRY) — the declared tree reproduces
 * that same order, not the usual identity-first convention.
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/edgeData.js';
const DEF_FACTORY = 'edgeDataDef';

const EXPECTED_ORDER = [
  // TOOL & CUT
  'dist', 'retract', 'f_fast', 'f_slow', 'port', 'radius',
  // IDENTITY
  'axis', 'dir',
  // GEOMETRY
  'wcs',
];

test('edge-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('edge-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async (a) => {
    const dd = await import(a.dataModule);
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const refMod = await import(a.refStackModule);
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');

    const def = dd[a.defFactory]();
    const dataBuilder = builderOf(dd[a.dataOptypeExport]);   // === instantiate(def, params) — the SAME path a real save uses

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
    refStackModule: '/wizards/stacks/edgeWizard.js', refStackExport: 'edgeStack',
    dataOptypeExport: 'EDGE_DATA_OPTYPE', defaultsExport: 'EDGE_DEFAULTS',
    editParam: 'dist', editValue: '45',
  });

  expect(r.beforeVal).toBe(15);   // EDGE_DEFAULTS.dist
  expect(r.afterVal).toBe(45);
  expect(r.eqPass, r.firstDiff ? JSON.stringify(r.firstDiff) : '').toBe(true);
});
