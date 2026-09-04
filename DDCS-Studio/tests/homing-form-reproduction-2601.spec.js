import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2601 (BACKLOG #71/#72, Phase 1) migrated homing_data onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree (mirroring drill/surfacing/bore/rotary_clock/alignment/edge/
 * middle/rotary_center). The FIRST structural-only op migrated (no value bindings at all — every param is a
 * plain bool toggle, no blockIndex/match to derive), so there is no two-phase bootstrap/final derive needed.
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — same reason as
 * the other shell-less twins this arc migrated: no dedicated classic shell page (`#wiz_homing` RETIRED at
 * t1730, index.html:1263). Same `.wiz-usage` collision. Test 1 below is copied directly from
 * `formReproduction.js`'s own test 1 (unmodified logic). Test 2 is a SIMPLER edit-reaches-model check than the
 * other migrated ops' own emit-equivalence tests — homing's own emit reads LIVE global settings
 * (`applyHomingRecompose`), already thoroughly covered by the dedicated `homing-data-emit.spec.js` (untouched by
 * this migration, since it never called the now-removed `homingDataStack()` either); duplicating that sweep here
 * would add settings-dependent complexity without adding coverage.
 *
 * EXPECTED_ORDER is HOMING_STRUCT_BINDINGS' own array order (one GEOMETRY section, no split) — confirmed live
 * (a scratch check against `renderOpForm`) that the `_setup` action-widget row ALSO renders `[data-param]`, so
 * it is included.
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/homingData.js';
const DEF_FACTORY = 'homingDataDef';

const EXPECTED_ORDER = ['run_z', 'run_x', 'run_y', 'run_a', 'run_b', 'softLimits', '_setup'];

test('homing-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('homing-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    editInput.checked = true;
    editInput.dispatchEvent(new Event('change', { bubbles: true }));

    const after = {};
    for (const read of readers) Object.assign(after, read());

    return { beforeVal: !!before[a.editParam], afterVal: !!after[a.editParam] };
  }, {
    dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR,
    editParam: 'run_a',
  });

  expect(r.beforeVal).toBe(false);   // HOMING_DEFAULTS.run_a
  expect(r.afterVal).toBe(true);
});
