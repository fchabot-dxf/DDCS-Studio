import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2599 (BACKLOG #71/#72, Phase 1) migrated middle_data onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree (mirroring drill/surfacing/bore/rotary_clock/alignment/edge).
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — same reason as the
 * other shell-less twins this arc migrated: no dedicated classic shell page (`#wiz_middle` RETIRED at t1730,
 * index.html:338). Same `.wiz-usage` collision. Tests 1 and 2 below are copied directly from
 * `formReproduction.js`'s own test 1/test 3 (unmodified logic).
 *
 * EXPECTED_ORDER is middleData.js's own declared IDENTITY/GEOMETRY/TOOL & CUT split (see `middleFieldGroups`).
 * ⚠ middle is the SECOND op (after edge) needing more than the usual two boxes' worth of care: the pre-t2599 flat
 * array had GEOMETRY split into TWO non-contiguous runs (the 8 struct toggles right after IDENTITY, then
 * crossX/crossY/diagTravel/diagPrimary again after TOOL & CUT) — `renderOpForm`'s own section grouping is
 * NAME-KEYED (t2545's own measured finding), so both runs merge into ONE GEOMETRY box positioned at the
 * section's first array occurrence. The declared tree reproduces that merge, not a fresh opinion on ordering.
 * The 4 prune-gated optional fields (crossX/crossY/diagTravel/diagPrimary) are listed here regardless of their
 * own `when`-gated visibility under MIDDLE_DEFAULTS (featureType=boss shows crossX/crossY; twoAxis=false hides
 * diagTravel/diagPrimary) — `field_ref` always renders the row, `when` only toggles CSS visibility, and the
 * row-diff gate counts DOM presence, matching bore's own identical precedent for its own per-pattern fields.
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/middleData.js';
const DEF_FACTORY = 'middleDataDef';

const EXPECTED_ORDER = [
  // IDENTITY
  'axisOrder', 'dir1', 'dir2', 'featureType',
  // GEOMETRY (merged: the 8 struct toggles, then the 4 prune-gated optionals)
  'inAxis', 'transAxis', 'travelShape', 'twoAxis', 'circular', 'probeZ', 'wcs', 'syncA',
  'crossX', 'crossY', 'diagTravel', 'diagPrimary',
  // TOOL & CUT
  'dist', 'retract', 'f_fast', 'f_slow', 'port', 'radius',
];

test('middle-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('middle-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    refStackModule: '/wizards/stacks/middleWizard.js', refStackExport: 'middleStack',
    dataOptypeExport: 'MIDDLE_DATA_OPTYPE', defaultsExport: 'MIDDLE_DEFAULTS',
    editParam: 'dist', editValue: '175',
  });

  expect(r.beforeVal).toBe(200);   // MIDDLE_DEFAULTS.dist
  expect(r.afterVal).toBe(175);
  expect(r.eqPass, r.firstDiff ? JSON.stringify(r.firstDiff) : '').toBe(true);
});
