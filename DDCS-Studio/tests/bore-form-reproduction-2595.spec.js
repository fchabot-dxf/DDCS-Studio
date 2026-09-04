import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2595 (BACKLOG #71/#72, Phase 1) migrated bore onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree (mirroring drill/surfacing).
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — DIAGNOSED
 * LIVE: its own "test 2" (usage text / code-preview label / section titles match the live shell) assumes
 * every migrated op has a REAL, dedicated classic shell page (`#wiz_drill`, `#wiz_surfacing`, ...). Bore has
 * NONE (grepped index.html for `wiz_bore` — zero hits; it was born a pure data-op, "fan-out port," always
 * auto-rendered through the GENERIC `#wiz_user` container). That generic container carries its OWN
 * always-present `#wiz_user_usage` element (userOpView.js:491-494, the "seamless title" mechanism — shows
 * the op's own recognized built-in label, e.g. "Bore", REGARDLESS of any declared `usage_text` node) which
 * ALSO carries `class="wiz-usage"` — the SAME class a declared `usage_text` node's own div uses
 * (formWidgets.js:1686). A blind `.wiz-usage` query is therefore ambiguous for a shell-less op: it can find
 * either element depending on DOM order, ALWAYS returning the static "Bore" title rather than a declared
 * usage_text's own real content. This is a genuine, real, pre-existing test-harness/product boundary this
 * turn found FIRST (bore is the first migrated op with no dedicated shell) — reported here, not silently
 * worked around by forcing a false assertion. `usage_text` was still added to bore's own uiChildren (real,
 * deliberate guidance content, matching every other tree-mode op's own quality bar) — it renders correctly
 * through the DIRECT `renderUiTree` path this file's own tests exercise below; only the LIVE-PAGE
 * `.wiz-usage` selector race (a `#wiz_user`-container-wide, pre-existing ambiguity, out of THIS turn's own
 * scope to fix) keeps it from being provable against a real page the same way drill/surfacing's own dedicated
 * shells allow. Tests 1 and 3 below are copied directly from `formReproduction.js`'s own test 1/test 3
 * (unmodified logic — both are fully self-contained, no shell dependency at all) rather than duplicating the
 * shared engine's own machinery for a two-thirds subset.
 *
 * EXPECTED_ORDER is boreData.js's own declared GEOMETRY/TOOL & CUT split (see `boreFieldGroups`): GEOMETRY
 * carries wcs, the placement scalars, then the full pattern cluster in BORE_BINDING_SPECS' own array order
 * (when-gated per-pattern fields included — `field_ref`'s own renderer hides/shows by each binding's `when`,
 * not by which group wraps it, confirmed against drillData.js's own identical pattern-field shape), then
 * entryX/entryY (no shell field, twin-only, placed beside the other GEOMETRY fields, matching surfacing's own
 * convention for the identical shared pair). TOOL & CUT carries toolNum first (matching drillData's own
 * toolNum-first convention), then the cut params in their own declared order.
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/boreData.js';
const DEF_FACTORY = 'boreDataDef';

const EXPECTED_ORDER = [
  // GEOMETRY
  'wcs',
  'stockAttach', 'pathDatum', 'stockDatum', 'stockW', 'stockH', 'stockZ', 'originX', 'originY', 'offZ',
  'pattern', 'x0', 'y0',
  'cols', 'rows', 'dx', 'dy',
  'count', 'spacing', 'angle',
  'dia', 'startAngle',
  'w', 'h', 'nx', 'ny',
  'skip',
  'entryX', 'entryY',
  // TOOL & CUT
  'toolNum', 'depth', 'holeDia', 'toolDia', 'pitch', 'ramp', 'feed', 'rpm',
];

test('bore-form-reproduction: declared tree places fields in the same structure as the shell', async ({ page }) => {
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

test('bore-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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

    const spindle = (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {};
    const base = { ...dd[a.defaultsExport], spindle };
    const emitParams = { ...base, ...after };
    const eq = emitEquivalence(refMod[a.refStackExport], dataBuilder, [emitParams]);

    return { beforeVal: Number(before[a.editParam]), afterVal: Number(after[a.editParam]), eqPass: eq.pass, firstDiff: eq.firstDiff };
  }, {
    dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR,
    refStackModule: '/wizards/stacks/drillWizard.js', refStackExport: 'drillStack',
    dataOptypeExport: 'BORE_DATA_OPTYPE', defaultsExport: 'BORE_DEFAULTS',
    editParam: 'depth', editValue: '17.5',
  });

  expect(r.beforeVal).toBe(5);   // BORE_DEFAULTS.depth
  expect(r.afterVal).toBe(17.5);
  expect(r.eqPass, r.firstDiff ? JSON.stringify(r.firstDiff) : '').toBe(true);
});
