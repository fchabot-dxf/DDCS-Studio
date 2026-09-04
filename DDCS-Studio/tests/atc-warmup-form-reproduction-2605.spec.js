import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2605 (BACKLOG #71/#72 conversion tier) converted atc_warmup's own 4 hand-counted
 * `blockIndex` bindings (via a `WRAP_PREFIX_COUNT`-style constant that had ALREADY desynced once, t2257) to
 * identity-based `match`, then migrated onto the declared tree. THE GENUINE WRINKLE this op surfaced: its two
 * stages (spindle-on + dwell, twice) are structurally IDENTICAL blocks with no per-stage identity field —
 * `{type:'spindle', params:{dir:'cw'}}` alone still matches both stages, and both dwells even share the same
 * DEFAULT `sec` value (time1=time2=30), so a value-based match would be genuinely ambiguous too. Resolved with
 * a small, real extension to `deriveBindings.js`'s own match vocabulary: `{type, params, nth}` — the Nth hit
 * within the type[+params]-filtered subset, immune to uiChildren restructuring (the actual hazard class this
 * whole conversion tier exists to close) because uiChildren never adds/removes `spindle`/`dwell` exec blocks.
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — like atc_table/
 * test/change/check/length, `#wiz_atc_warmup` (index.html:941) is a real, still-live classic shell this twin
 * stays unlinked from. Test 3 is the REAL-SYMPTOM canvas-mount proof (t2603's own standing rule): a row diff
 * alone would pass even if `nth` picked the WRONG stage (e.g. rpm1 silently bound to stage 2's own spindle
 * block) — only checking the REAL EMIT proves the right block, not just A block, was matched.
 *
 * EXPECTED_ORDER is ATC_WARMUP_BINDINGS' own array order (one section, "WARM-UP SEQUENCE").
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/atcWarmupData.js';
const DEF_FACTORY = 'atcWarmupDataDef';

const EXPECTED_ORDER = ['rpm1', 'time1', 'rpm2', 'time2'];

test('atc-warmup-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('atc-warmup-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    refStackModule: '/wizards/stacks/atcWarmupWizard.js', refStackExport: 'atcWarmupStack',
    dataOptypeExport: 'ATC_WARMUP_DATA_OPTYPE', defaultsExport: 'ATC_WARMUP_DEFAULTS',
    editParam: 'rpm2', editValue: '18000',
  });

  expect(r.beforeVal).toBe(12000);   // ATC_WARMUP_DEFAULTS.rpm2
  expect(r.afterVal).toBe(18000);
  expect(r.eqPass, r.firstDiff ? JSON.stringify(r.firstDiff) : '').toBe(true);
});

test('atc-warmup-form-reproduction: REAL SYMPTOM — each stage binds to its OWN block, not the other stage\'s (proves nth, not just row structure)', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/atcWarmupData.js'); try { U.registerUserOp(M.atcWarmupDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_atc_warmup_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  // set all 4 to DISTINCT values — if `nth` ever picked the wrong stage, this cross-wires two fields' emit
  await page.evaluate(() => {
    const set = (param, v) => { const e = document.querySelector(`[data-param="${param}"]`); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('rpm1', '7000'); set('time1', '11'); set('rpm2', '19000'); set('time2', '22');
  });
  await page.waitForTimeout(300);
  const code = await page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');

  const wizUser = await page.evaluate(() => {
    const w = document.getElementById('wiz_user');
    const visible = (sel) => [...(w ? w.querySelectorAll(sel) : [])].some((e) => e.offsetParent !== null);
    return {
      canvasCount: w ? w.querySelectorAll('canvas').length : 0,
      treeBoxVisible: visible('[id$="userVizBox_tree"][data-viz-pane="preview3d"]'),
    };
  });

  expect(code, 'stage 1 rpm reaches the real emit').toMatch(/S7000\b/);
  expect(code, 'stage 2 rpm reaches the real emit, NOT stage 1\'s value').toMatch(/S19000\b/);
  // dwell emits in ms on this dialect (11s -> P11000), confirmed live rather than assumed
  expect(code, 'stage 1 dwell reaches the real emit').toMatch(/P11000\b/);
  expect(code, 'stage 2 dwell reaches the real emit, NOT stage 1\'s value').toMatch(/P22000\b/);
  expect(wizUser.canvasCount, 'a real 3D canvas mounts').toBeGreaterThan(0);
  expect(wizUser.treeBoxVisible, 'the declared tree-mode 3D box is the one actually visible').toBe(true);
  expect(errs, 'no console errors').toEqual([]);
});
