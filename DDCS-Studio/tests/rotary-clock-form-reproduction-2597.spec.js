import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2597 (BACKLOG #71/#72, Phase 1) migrated rotary_clock_data onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree (mirroring drill/surfacing/bore).
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — same reason as
 * bore-form-reproduction-2595.spec.js: its own "test 2" (usage text / code-preview label / section titles match
 * the live shell) assumes a REAL, dedicated classic shell page. Rotary Clock has none — `#wiz_rotary_clock` was
 * RETIRED at t1730 (index.html:345), replaced by this twin, which is always auto-rendered through the GENERIC
 * `#wiz_user` container. Same `.wiz-usage` collision bore's own header documents. Tests 1 and 2 below are copied
 * directly from `formReproduction.js`'s own test 1/test 3 (unmodified logic — both are fully self-contained, no
 * shell dependency at all) rather than duplicating the shared engine's own machinery for a two-thirds subset.
 *
 * EXPECTED_ORDER is rotaryClockData.js's own declared GEOMETRY/TOOL & CUT split (see `rotaryClockFieldGroups`):
 * the declared tree places the GEOMETRY group_box first, TOOL & CUT second (rotaryClockDataDef's own uiChildren
 * order). GEOMETRY carries span, safeZ (the two remaining value sockets), then action (struct), then reference,
 * wcs (value-swap) — the same relative order the pre-t2597 flat bindings array produced when filtered by
 * section (value bindings first, struct second, value-swap third — none of the three groups reorders
 * internally). TOOL & CUT carries the 5 probe-motion scalars in ROTARY_CLOCK_BINDING_SPECS' own array order.
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/rotaryClockData.js';
const DEF_FACTORY = 'rotaryClockDataDef';

const EXPECTED_ORDER = [
  // GEOMETRY
  'span', 'safeZ', 'action', 'reference', 'wcs',
  // TOOL & CUT
  'dist', 'retract', 'f_fast', 'f_slow', 'port',
];

test('rotary-clock-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('rotary-clock-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    refStackModule: '/wizards/stacks/rotaryClockWizard.js', refStackExport: 'rotaryClockStack',
    dataOptypeExport: 'ROTARY_CLOCK_DATA_OPTYPE', defaultsExport: 'ROTARY_CLOCK_DEFAULTS',
    editParam: 'span', editValue: '35',
  });

  expect(r.beforeVal).toBe(20);   // ROTARY_CLOCK_DEFAULTS.span
  expect(r.afterVal).toBe(35);
  expect(r.eqPass, r.firstDiff ? JSON.stringify(r.firstDiff) : '').toBe(true);
});
