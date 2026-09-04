import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2631 (BACKLOG #71/#72, THE GATED PILOT, LAST OP) migrated corner_data onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree (mirroring drill/surfacing/bore/rotary_clock/alignment/edge).
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — same reason as
 * edge/bore/rotary_clock/alignment's own standalone specs: its own "test 2" assumes a REAL, dedicated classic
 * shell page. Corner has none — the built-in Corner view was RETIRED (web/wizards/views/index.js's own t1670
 * comment: "this twin is the ONLY live UI surface for Corner"). Tests 1 and 2 below are copied directly from
 * `formReproduction.js`'s own test 1/test 3 (unmodified logic), matching edge-form-reproduction-2599.spec.js's
 * own precedent exactly.
 *
 * EXPECTED_ORDER is cornerData.js's own declared IDENTITY/GEOMETRY/TOOL & CUT split (see `cornerFieldGroups`).
 * All three are canonical `SECTION_RANK` names, so the classic render's own `units.sort(sectionRankOf)` already
 * reorders correctly regardless of array position (t2613's own measurement, confirmed by
 * `tests/section-order-parity-2617.spec.js`, the cross-op guard) — no array reorder was needed for this
 * migration, only the group_box tree itself in the same IDENTITY -> GEOMETRY -> TOOL & CUT order.
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/cornerData.js';
const DEF_FACTORY = 'cornerDataDef';

const EXPECTED_ORDER = [
  // IDENTITY
  'corner', 'probeSeq',
  // GEOMETRY — struct fields (the big structural forks) lead, then the value sockets that tune them
  'probeZFirst', 'travelApproach', 'travelShape', 'wcs', 'syncA',
  'travelDist', 'safeZ', 'scanDepth', 'clearMode', 'hopDist', 'planeZ', 'cross1_x', 'cross1_y', 'startX', 'startY',
  // TOOL & CUT
  'dist', 'retract', 'f_fast', 'f_slow', 'port', 'radius',
];

test('corner-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('corner-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    refStackModule: '/wizards/stacks/cornerWizard.js', refStackExport: 'cornerStack',
    dataOptypeExport: 'CORNER_DATA_OPTYPE', defaultsExport: 'CORNER_DEFAULTS',
    editParam: 'dist', editValue: '45',
  });

  expect(r.beforeVal).toBe(500);   // CORNER_DEFAULTS.dist
  expect(r.afterVal).toBe(45);
  expect(r.eqPass, r.firstDiff ? JSON.stringify(r.firstDiff) : '').toBe(true);
});
