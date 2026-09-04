import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2599 (BACKLOG #71/#72, Phase 1) migrated alignment_data onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree (mirroring drill/surfacing/bore/rotary_clock).
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — same reason as
 * bore/rotary_clock's own standalone specs: its own "test 2" (usage text / code-preview label / section titles
 * match the live shell) assumes a REAL, dedicated classic shell page. Alignment has none — `#wiz_alignment` was
 * RETIRED at t1730 (index.html:891), replaced by this twin, always auto-rendered through the GENERIC
 * `#wiz_user` container. Same `.wiz-usage` collision bore's own header documents. Tests 1 and 2 below are
 * copied directly from `formReproduction.js`'s own test 1/test 3 (unmodified logic, no shell dependency).
 *
 * EXPECTED_ORDER is alignmentData.js's own declared GEOMETRY/TOOL & CUT split (see `alignmentFieldGroups`):
 * GEOMETRY carries safeZ, span (the two value sockets), then travel, checkAxis, probeDir (struct), then
 * tolerance (value-swap) — the same relative order the pre-t2599 flat bindings array produced when filtered by
 * section. TOOL & CUT carries the 5 probe-motion scalars in ALIGNMENT_BINDING_SPECS' own array order.
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/alignmentData.js';
const DEF_FACTORY = 'alignmentDataDef';

const EXPECTED_ORDER = [
  // GEOMETRY
  'safeZ', 'span', 'travel', 'checkAxis', 'probeDir', 'tolerance',
  // TOOL & CUT
  'dist', 'retract', 'f_fast', 'f_slow', 'port',
];

test('alignment-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('alignment-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    refStackModule: '/wizards/stacks/alignmentWizard.js', refStackExport: 'alignmentStack',
    dataOptypeExport: 'ALIGNMENT_DATA_OPTYPE', defaultsExport: 'ALIGNMENT_DEFAULTS',
    editParam: 'safeZ', editValue: '25',
  });

  expect(r.beforeVal).toBe(10);   // ALIGNMENT_DEFAULTS.safeZ
  expect(r.afterVal).toBe(25);
  expect(r.eqPass, r.firstDiff ? JSON.stringify(r.firstDiff) : '').toBe(true);
});
