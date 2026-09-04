import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2617 (BACKLOG #71/#72, Phase 1) migrated odProbeData.js onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree — the FOURTH of the seven lathe-family ops, same shape as
 * faceProbeData.js's own t2617 migration (rebuild-from-resolved-params postInstantiate, `simstart` kept in
 * `uiChildren`). Rule 17 (self-applied): grepped the whole `tests/` directory for
 * `user_lathe_odprobe`/`OD_PROBE_DATA_OPTYPE`/`odProbeData` before calling this migration verified.
 *
 * EXPECTED_ORDER declared in the canonical SECTION_RANK order from the start (IDENTITY/TOOL & CUT).
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/odProbeData.js';
const DEF_FACTORY = 'odProbeDataDef';

const EXPECTED_ORDER = [
  // IDENTITY
  'caliperDiameter', 'wcs',
  // TOOL & CUT
  'tipRadius', 'maxDist', 'retract', 'feedFast', 'feedSlow', 'port',
];

test('odprobe-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('odprobe-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async (a) => {
    const dd = await import(a.dataModule);
    const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
    const { builderOf } = await import('/blocks/opBuilders.js');

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

    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const emitParams = { ...dd[a.defaultsExport], ...after };
    const built = dataBuilder(emitParams);
    const text = emitMapped(built).text;

    return { beforeVal: Number(before[a.editParam]), afterVal: Number(after[a.editParam]), text };
  }, {
    dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR,
    dataOptypeExport: 'OD_PROBE_DATA_OPTYPE', defaultsExport: 'OD_PROBE_DEFAULTS',
    editParam: 'caliperDiameter', editValue: '30.5',
  });

  expect(r.afterVal).toBe(30.5);
  expect(r.text, 'the rebuilt macro carries the edited caliperDiameter value').toContain('30.5');
});

test('odprobe-form-reproduction: the lathe half-profile mounts as a REAL 2D canvas, no unwired placeholder', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/odProbeData.js'); try { U.registerUserOp(M.odProbeDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_lathe_odprobe'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const wizUser = document.getElementById('wiz_user');
    const visible = (sel) => [...(wizUser ? wizUser.querySelectorAll(sel) : [])].some((e) => e.offsetParent !== null);
    const layout2dHost = wizUser ? [...wizUser.querySelectorAll('[data-viz-pane="layout2d"]')].find((e) => e.offsetParent !== null) : null;
    const svg = layout2dHost ? layout2dHost.querySelector('svg') : null;
    return {
      unwiredPlaceholderCount: wizUser ? wizUser.querySelectorAll('.unwired-block').length : -1,
      has3dPaneVisible: visible('[data-viz-pane="preview3d"]'),
      has2dPaneVisible: !!layout2dHost,
      canvasCount: wizUser ? wizUser.querySelectorAll('canvas').length : 0,
      svgChildCount: svg ? svg.childElementCount : -1,
    };
  });

  expect(r.unwiredPlaceholderCount, 'NEITHER layout NOR simstart renders an unwired placeholder').toBe(0);
  expect(r.has3dPaneVisible, 'form3d+2d: the 3D bar pane is also visible').toBe(true);
  expect(r.has2dPaneVisible, 'the 2D layout pane is visible').toBe(true);
  expect(r.canvasCount, 'a real 3D canvas mounts').toBeGreaterThan(0);
  expect(r.svgChildCount, 'the 2D pane\'s SVG has real drawn content (the half-profile), not an empty shell').toBeGreaterThan(0);
});
