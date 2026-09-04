import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2605 (BACKLOG #71/#72 conversion tier) converted wcs_data's own 6 hand-counted
 * `blockIndex: 0` bindings (via a `WRAP` constant — the exact hazard class t2257 caught the hard way on
 * atcWarmupData.js, this file's own comment had already named it) to identity-based `match: {type:'wcszero'}`
 * — the ONE block in the whole exec stack. Unlike atc_warmup, no `nth` is needed: all 6 bindings target the
 * SAME single block, disambiguated by `key`, not by which block — the simplest of the three conversion-tier
 * ops structurally, despite having the most bindings (6, not the 7 named in the dispatch — recounted from the
 * file directly: axisX/axisY/axisZ/sys/sync/slave).
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — `#wiz_wcs`
 * (index.html:1220) is a real, still-live classic shell this twin stays unlinked from (opened separately).
 * panel='form' (viz:false) — the SAME no-viz shape io_step/pause_confirm already proved. Test 3 is the
 * REAL-SYMPTOM proof (t2603's own standing rule) — opens the real page, edits multiple fields, and checks the
 * REAL emitted register writes change correctly, not just that the row-diff model updates.
 *
 * EXPECTED_ORDER is WCS_BINDING_SPECS' own array order, grouped by section (FEATURE CONTEXT, WCS, OPTIONS —
 * all three contiguous runs).
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/wcsData.js';
const DEF_FACTORY = 'wcsDataDef';

const EXPECTED_ORDER = [
  // FEATURE CONTEXT
  'axisX', 'axisY', 'axisZ',
  // WCS
  'sys',
  // OPTIONS
  'sync', 'slave',
];

test('wcs-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('wcs-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    editInput.checked = true;
    editInput.dispatchEvent(new Event('change', { bubbles: true }));

    const after = {};
    for (const read of readers) Object.assign(after, read());

    const emitParams = { ...dd[a.defaultsExport], ...after };
    const eq = emitEquivalence(refMod[a.refStackExport], dataBuilder, [emitParams]);

    return { beforeVal: !!before[a.editParam], afterVal: !!after[a.editParam], eqPass: eq.pass, firstDiff: eq.firstDiff };
  }, {
    dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR,
    refStackModule: '/wizards/stacks/wcsWizard.js', refStackExport: 'wcsStack',
    dataOptypeExport: 'WCS_DATA_OPTYPE', defaultsExport: 'WCS_DEFAULTS',
    editParam: 'axisZ',
  });

  expect(r.beforeVal).toBe(false);   // WCS_DEFAULTS.axisZ
  expect(r.afterVal).toBe(true);
  expect(r.eqPass, r.firstDiff ? JSON.stringify(r.firstDiff) : '').toBe(true);
});

test('wcs-form-reproduction: REAL SYMPTOM — a real page open + edit changes the actual register writes', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/wcsData.js'); try { U.registerUserOp(M.wcsDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_wcs_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');

  await page.evaluate(() => {
    const zEl = document.querySelector('[data-param="axisZ"]');
    zEl.checked = true;
    zEl.dispatchEvent(new Event('change', { bubbles: true }));
    const sysEl = document.querySelector('[data-param="sys"]');
    sysEl.value = '54';
    sysEl.dispatchEvent(new Event('input', { bubbles: true }));
    sysEl.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');

  expect(before, 'default: X+Y zeroed, Z not (axisZ default false)').toContain('#[#151+0]=#880\n#[#151+1]=#881');
  expect(before, 'default: no Z write').not.toMatch(/#\[#151\+2\]/);
  expect(after, 'edited: X/Y/Z all zeroed against the FIXED G54 base address').toContain('#805=#880\n#806=#881\n#807=#882');
  expect(after, 'edited: the fixed-WCS comment names G54').toMatch(/Fixed WCS: G54/);
  expect(errs, 'no console errors').toEqual([]);
});
