import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2605 (BACKLOG #71/#72) converted pause_confirm's own single `blockIndex: 2` binding to
 * identity-based `match: {type: 'pauseconfirm'}` (the cheapest of the six positional-binding ops — 1 binding,
 * a pure rename, no structural ambiguity), then migrated onto the declared `split_horizontal`/`group_box`/
 * `field_ref` tree. panel='form' (`viz:false`) — the SAME no-viz shape io_step already proved (t2601): no
 * viz-mounting code runs in either render path, so the RIGHT pane is declared empty.
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — never had a
 * classic shell (opened in-place from a built-in setup entry). Test 3 is the panel='form' analogue of the
 * ATC-five's own "does a real canvas mount" proof (t2603, the advisor's own explicit standing rule now): since
 * there is no canvas to prove for a viz:false panel, the equivalent REAL-SYMPTOM check is that the op actually
 * OPENS and EMITS on a real page, not just that the row-diff structure matches — a row diff alone would pass
 * even if e.g. the field never actually reached the emitted op (the exact class of gap #77's own row-diff-only
 * bar would have missed).
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/pauseConfirmData.js';
const DEF_FACTORY = 'pauseConfirmDataDef';

const EXPECTED_ORDER = ['msg'];

test('pause-confirm-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('pause-confirm-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    editInput.value = a.editValue;
    editInput.dispatchEvent(new Event('input', { bubbles: true }));
    editInput.dispatchEvent(new Event('change', { bubbles: true }));

    const after = {};
    for (const read of readers) Object.assign(after, read());

    return { beforeVal: before[a.editParam], afterVal: after[a.editParam] };
  }, {
    dataModule: DATA_MODULE, defFactory: DEF_FACTORY, rowSelector: ROW_SELECTOR,
    editParam: 'msg', editValue: 'Load the next fixture',
  });

  expect(r.afterVal).toBe('Load the next fixture');
  expect(r.afterVal).not.toBe(r.beforeVal);
});

test('pause-confirm-form-reproduction: a real page open emits the edited message (REAL SYMPTOM, not just structure)', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/pauseConfirmData.js'); try { U.registerUserOp(M.pauseConfirmDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_pause_confirm'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.evaluate(() => {
    const f = document.querySelector('#wiz_user_form [data-param="msg"]');
    f.value = 'Check the fixture clamps';
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const code = await page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');
  expect(code, 'the edited message reaches the real emitted code, not just the row-diff model').toContain('Check the fixture clamps');
  expect(code, 'the M00 program stop is still emitted').toMatch(/M00\b/);
  expect(errs, 'no console errors on open/edit').toEqual([]);
});
