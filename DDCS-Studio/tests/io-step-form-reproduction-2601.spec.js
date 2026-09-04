import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2601 (BACKLOG #71/#72, Phase 1) migrated io_step onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree. A GENUINE NEW SHAPE: panel `'form'` (`viz:false` per
 * `panelTypes.js:45`) — CONFIRMED LIVE that no viz-mounting code runs for this panel kind in either render
 * path (`userOpView.js`'s own `pt.mode==='3d2d'/'3d'/'2d'/'commscreen'` dispatch has no branch for `mode:null`),
 * so the RIGHT pane is declared EMPTY (`RIGHT: []`) — no preview3d/feature_canvas at all, since there is no
 * preview to carry across. Verified live before shipping: a scratch open + screenshot showed a plain, harmless
 * empty pane, no console errors, matching the classic "Form only" intent.
 *
 * NOT built on `tests/support/formReproduction.js`'s shared `registerFormReproductionSuite` — io_step never had
 * a classic shell at all (opened in-place from a built-in setup entry, per this file's own header) — same
 * `.wiz-usage` reasoning as the other shell-less twins. Test 2 is a simplified edit-reaches-model check (not a
 * full `emitEquivalence` sweep) — `io-step-emit.spec.js` already covers byte-equivalence for this op's own
 * declared-I/O recompose complexity.
 *
 * EXPECTED_ORDER is IO_STEP_BINDINGS' own array order: mode (IDENTITY) then the rest (GEOMETRY).
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';
const DATA_MODULE = '/blocks/dataOps/ioStepData.js';
const DEF_FACTORY = 'ioStepDataDef';

const EXPECTED_ORDER = ['mode', 'outputRef', 'state', 'pin', 'inputRef', 'mode2', 'timeout', 'var', 'waitPin', 'sec'];

test('io-step-form-reproduction: declared tree places fields in the same structure as the flat form', async ({ page }) => {
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

test('io-step-form-reproduction: an edit in the declared tree reaches the op model and comes back', async ({ page }) => {
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
    editParam: 'pin', editValue: '7',
  });

  expect(Number(r.beforeVal)).toBe(0);   // IO_STEP_DEFAULTS.pin
  expect(Number(r.afterVal)).toBe(7);
});
